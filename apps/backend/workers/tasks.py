# ─────────────────────────────────────────────────────────────
# Trailback — Celery Rollback Task
#
# ADR-002: The rollback system must NEVER mutate the original
# event row's content. Instead it:
#   1. Calls the 3rd-party API to reverse the action
#   2. Inserts a compensating event row (append-only)
#   3. Updates rollback_status on the original event
#
# Retry policy: exponential backoff + jitter, max 3 retries.
# ─────────────────────────────────────────────────────────────

import asyncio
import uuid
from datetime import datetime, timezone

from celery import Task
from db.supabase_client import supabase
from workers.celery_app import celery_app


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run_async(coro):
    """Run an async coroutine synchronously inside a Celery task."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Running inside an existing event loop (rare in Celery) — use nest
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(coro)
        return loop.run_until_complete(coro)
    except RuntimeError:
        # No event loop in this thread — create one
        return asyncio.run(coro)


@celery_app.task(
    bind=True,
    name="workers.tasks.execute_rollback",
    max_retries=3,
    default_retry_delay=10,   # replaced by autoretry_for on raise
    soft_time_limit=90,       # warn at 90 s
    time_limit=120,           # hard kill at 120 s
)
def execute_rollback(self: Task, rollback_id: str, event_id: str, user_id: str):
    """
    Execute a rollback for a single event.

    Steps:
      1. Fetch event from Supabase (owned by user_id)
      2. Fetch active connector oauth_token for the event's app
      3. Dispatch to the correct connector function
      4. On success:
         - Update rollbacks row → result="success"
         - Insert compensating event row (ADR-002 append-only)
         - Update original event rollback_status="executed"
      5. On failure:
         - Update rollbacks row → result="failed"
         - Retry with exponential backoff + jitter
    """
    try:
        # ── Step 1: Fetch event ────────────────────────────────
        event_result = supabase.table("events") \
            .select("*") \
            .eq("id", event_id) \
            .eq("user_id", user_id) \
            .execute()

        if not event_result.data:
            raise ValueError(f"Event {event_id} not found or does not belong to user {user_id}")

        event = event_result.data[0]
        app_name = event["app"]
        metadata = event.get("metadata", {})

        # ── Step 2: Fetch connector oauth_token ───────────────
        connector_result = supabase.table("connectors") \
            .select("oauth_token") \
            .eq("app", app_name) \
            .eq("user_id", user_id) \
            .eq("is_active", True) \
            .execute()

        if not connector_result.data or not connector_result.data[0].get("oauth_token"):
            raise ValueError(
                f"No active connector found for app='{app_name}' and user={user_id}"
            )

        oauth_token = connector_result.data[0]["oauth_token"]

        # ── Step 3: Dispatch to connector ─────────────────────
        result = None

        if app_name == "gmail":
            message_id = metadata.get("message_id")
            if not message_id:
                raise ValueError("No message_id in event metadata")

            from connectors.gmail import trash_email
            result = _run_async(trash_email(message_id, oauth_token))

            if not result.get("success"):
                raise ValueError(result.get("error", "Gmail trash failed"))

        elif app_name == "gdocs":
            # Accept both keys — interceptor may send either
            file_id = metadata.get("file_id") or metadata.get("document_id")
            revision_id = metadata.get("revision_id")
            if not file_id or not revision_id:
                raise ValueError("No file_id/document_id or revision_id in event metadata")

            from connectors.gdocs import restore_revision
            result = _run_async(restore_revision(file_id, revision_id, oauth_token))

            if not result.get("success"):
                raise ValueError(result.get("error", "Google Docs restore failed"))

        elif app_name == "slack":
            channel = metadata.get("channel")
            ts = metadata.get("ts")
            if not channel or not ts:
                raise ValueError("No channel or ts in event metadata")

            from connectors.slack import delete_message
            result = _run_async(delete_message(channel, ts, oauth_token))

            if not result.get("success"):
                raise ValueError(result.get("error", "Slack delete failed"))

        else:
            raise ValueError(f"Unknown app: '{app_name}'")

        # ── Step 4a: Update rollbacks row → success ───────────
        supabase.table("rollbacks").update({
            "result":       "success",
            "api_response": result,
            "executed_at":  _now_utc(),
        }).eq("id", rollback_id).execute()

        # ── Step 4b: Insert compensating event (ADR-002) ──────
        # Append-only: never mutate the original event content.
        # A compensating row records that the action was reversed.
        supabase.table("events").insert({
            "user_id":        user_id,
            "agent_id":       event.get("agent_id", "system"),
            "app":            app_name,
            "action_type":    f"rollback.{event['action_type']}",
            "intent":         f"Rollback of event {event_id}",
            "metadata":       {
                "original_event_id": event_id,
                "rollback_id":       rollback_id,
                **metadata,
            },
            "risk_level":     "low",
            "risk_score":     0,
            "risk_reasons":   [],
            "rollback_status": "unavailable",   # Rollbacks don't themselves roll back
            "status":         "completed",
            "idempotency_key": f"rollback-{rollback_id}",
        }).execute()

        # ── Step 4c: Mark original event as executed ──────────
        supabase.table("events").update({
            "rollback_status": "executed",
            "status":          "rolled_back",
        }).eq("id", event_id).execute()

        return {"status": "success", "rollback_id": rollback_id}

    except Exception as exc:
        failure_reason = str(exc)

        # Update rollbacks to failed before retrying
        try:
            supabase.table("rollbacks").update({
                "result":         "failed",
                "failure_reason": failure_reason,
            }).eq("id", rollback_id).execute()
        except Exception:
            pass  # Non-fatal — don't shadow the original exception

        # Retry with exponential backoff + jitter
        raise self.retry(
            exc=exc,
            countdown=10 * (2 ** self.request.retries),  # 10s, 20s, 40s
            jitter=True,
        )
