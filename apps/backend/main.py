# ─────────────────────────────────────────────────────────────
# Trailback — FastAPI Backend
# ─────────────────────────────────────────────────────────────

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from db.supabase_client import supabase
from core.risk_classifier import classify_event
from models.event import EventPayload
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import hashlib
import json
import os

app = FastAPI(title="Trailback API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "chrome-extension://pjpekdpkbabnhkcfdkkdljnefobjicff"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/health")
async def health():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "db": "connected"
    }


# ─────────────────────────────────────────────────────────────
# POST /events — Ingest an agent action
# ─────────────────────────────────────────────────────────────

@app.post("/api/v1/events", status_code=201)
async def ingest_event(payload: EventPayload):

    # ── Step 1: Idempotency check ─────────────────────────────
    if payload.idempotency_key:
        existing = supabase.table("events") \
            .select("id, risk_level, rollback_status") \
            .eq("idempotency_key", payload.idempotency_key) \
            .execute()

        if existing.data:
            return {
                "event_id": existing.data[0]["id"],
                "risk_level": existing.data[0]["risk_level"],
                "rollback_status": existing.data[0]["rollback_status"],
                "duplicate": True
            }

    # ── Step 2: Run risk classification ───────────────────────
    risk = classify_event(
        app=payload.app,
        action_type=payload.action_type,
        metadata=payload.metadata,
        before=payload.before_snapshot.dict() if payload.before_snapshot else None,
        after=payload.after_snapshot,
        agent=None
    )

    # ── Step 3: Insert into events table ──────────────────────
    event_insert = supabase.table("events").insert({
        "agent_id":         payload.agent_id,
        "app":              payload.app,
        "action_type":      payload.action_type,
        "intent":           payload.intent,
        "metadata":         payload.metadata,
        "risk_level":       risk.level,
        "risk_score":       risk.score,
        "risk_reasons":     risk.reasons,
        "rollback_status":  "available",
        "status":           "completed",
        "idempotency_key":  payload.idempotency_key,
        "user_id":          payload.user_id,
    }).execute()

    if not event_insert.data:
        raise HTTPException(status_code=500, detail="Failed to insert event")

    event_id = event_insert.data[0]["id"]

    # ── Step 4: Insert before snapshot ────────────────────────
    if payload.before_snapshot and payload.before_snapshot.content:
        before_content = payload.before_snapshot.dict()
        before_str = json.dumps(before_content)
        supabase.table("snapshots").insert({
            "event_id":      event_id,
            "snapshot_type": "before",
            "content":       before_content,
            "content_hash":  hashlib.sha256(before_str.encode()).hexdigest()
        }).execute()

    # ── Step 5: Insert after snapshot ─────────────────────────
    if payload.after_snapshot:
        after_str = json.dumps(payload.after_snapshot)
        supabase.table("snapshots").insert({
            "event_id":      event_id,
            "snapshot_type": "after",
            "content":       payload.after_snapshot,
            "content_hash":  hashlib.sha256(after_str.encode()).hexdigest()
        }).execute()

    # ── Step 6: Return response ───────────────────────────────
    return {
        "event_id":        event_id,
        "risk_level":      risk.level,
        "risk_score":      risk.score,
        "risk_reasons":    risk.reasons,
        "rollback_status": "available",
        "created_at":      datetime.utcnow().isoformat()
    }


# ─────────────────────────────────────────────────────────────
# GET /timeline — Paginated event feed
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/timeline")
async def get_timeline(
    limit: int = 20,
    offset: int = 0,
    app: str = None,
    risk_level: str = None
):
    query = supabase.table("events") \
        .select("*") \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1)

    if app:
        query = query.eq("app", app)
    if risk_level:
        query = query.eq("risk_level", risk_level)

    result = query.execute()

    return {
        "events":   result.data or [],
        "limit":    limit,
        "offset":   offset,
        "has_more": len(result.data or []) == limit
    }


# ─────────────────────────────────────────────────────────────
# Request model for rollback
# ─────────────────────────────────────────────────────────────

class RollbackRequest(BaseModel):
    confirmation: bool
    reason: Optional[str] = None


# ─────────────────────────────────────────────────────────────
# GET /api/v1/events/{event_id} — Single event detail
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/events/{event_id}")
async def get_event(event_id: str):

    result = supabase.table("events") \
        .select("*") \
        .eq("id", event_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    return result.data[0]


# ─────────────────────────────────────────────────────────────
# GET /api/v1/events/{event_id}/diff — Before/after diff
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/events/{event_id}/diff")
async def get_diff(event_id: str):

    event_result = supabase.table("events") \
        .select("*") \
        .eq("id", event_id) \
        .execute()

    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    event = event_result.data[0]

    snapshots_result = supabase.table("snapshots") \
        .select("*") \
        .eq("event_id", event_id) \
        .execute()

    snapshots = snapshots_result.data or []

    before = next((s for s in snapshots if s["snapshot_type"] == "before"), None)
    after  = next((s for s in snapshots if s["snapshot_type"] == "after"),  None)

    return {
        "event_id":           event_id,
        "app":                event["app"],
        "action_type":        event["action_type"],
        "agent_id":           event["agent_id"],
        "risk_level":         event["risk_level"],
        "risk_score":         event["risk_score"],
        "risk_reasons":       event["risk_reasons"],
        "rollback_available": event["rollback_status"] == "available",
        "rollback_status":    event["rollback_status"],
        "before": {
            "content":      before["content"] if before else None,
            "content_hash": before["content_hash"] if before else None,
            "captured_at":  before["captured_at"] if before else None,
        } if before else None,
        "after": {
            "content":      after["content"] if after else None,
            "content_hash": after["content_hash"] if after else None,
            "captured_at":  after["captured_at"] if after else None,
        } if after else None,
        "created_at": event["created_at"],
    }


# ─────────────────────────────────────────────────────────────
# Helper — Recompute agent trust score after rollback
# ─────────────────────────────────────────────────────────────

async def update_agent_trust(agent_id: str):
    try:
        result = supabase.table("agents") \
            .select("total_actions, rolled_back") \
            .eq("id", agent_id) \
            .execute()

        if not result.data:
            return

        agent = result.data[0]
        total = agent.get("total_actions", 0) + 1
        rolled_back = agent.get("rolled_back", 0) + 1
        trust_score = round(1 - (rolled_back / total), 4) if total > 0 else 1.0

        supabase.table("agents").update({
            "total_actions": total,
            "rolled_back":   rolled_back,
            "trust_score":   trust_score
        }).eq("id", agent_id).execute()

    except Exception as e:
        print(f"Warning: could not update agent trust score: {e}")


# ─────────────────────────────────────────────────────────────
# POST /api/v1/rollback/{event_id} — Execute rollback
# ─────────────────────────────────────────────────────────────

@app.post("/api/v1/rollback/{event_id}", status_code=202)
async def initiate_rollback(event_id: str, payload: RollbackRequest):

    # ── Step 1: Require explicit confirmation ─────────────────
    if not payload.confirmation:
        raise HTTPException(
            status_code=422,
            detail="Rollback requires confirmation: true"
        )

    # ── Step 2: Fetch the event ───────────────────────────────
    event_result = supabase.table("events") \
        .select("*") \
        .eq("id", event_id) \
        .execute()

    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    event = event_result.data[0]

    # ── Step 3: Check rollback eligibility ───────────────────
    if event["rollback_status"] != "available":
        raise HTTPException(
            status_code=422,
            detail={
                "code":            "ROLLBACK_UNAVAILABLE",
                "message":         f"This event cannot be rolled back. Current status: {event['rollback_status']}",
                "rollback_status": event["rollback_status"]
            }
        )

    # ── Step 4: Create rollback record (pending) ──────────────
    rollback_insert = supabase.table("rollbacks").insert({
        "event_id":     event_id,
        "user_id":      event.get("user_id"),
        "initiated_by": "user",
        "result":       "pending",
    }).execute()

    rollback_id = rollback_insert.data[0]["id"]

    # ── Step 5: Execute rollback based on app ────────────────
    result = None
    failure_reason = None

    try:
        if event["app"] == "gmail":
            message_id = event.get("metadata", {}).get("message_id")
            if not message_id:
                raise ValueError("No message_id found in event metadata")

            # ── Fixed: filter by user_id ──────────────────────
            connector = supabase.table("connectors") \
                .select("oauth_token") \
                .eq("app", "gmail") \
                .eq("user_id", event.get("user_id")) \
                .execute()

            if not connector.data or not connector.data[0].get("oauth_token"):
                raise ValueError("Gmail connector not found or not authorized")

            oauth_token = connector.data[0]["oauth_token"]

            from connectors.gmail import trash_email
            result = await trash_email(message_id, oauth_token)

            if not result.get("success"):
                raise ValueError(result.get("error", "Gmail trash failed"))

        elif event["app"] == "slack":
            channel = event.get("metadata", {}).get("channel")
            ts = event.get("metadata", {}).get("ts")
            if not channel or not ts:
                raise ValueError("No channel or ts found in event metadata")

            connector = supabase.table("connectors") \
                .select("oauth_token") \
                .eq("app", "slack") \
                .eq("user_id", event.get("user_id")) \
                .execute()

            if not connector.data or not connector.data[0].get("oauth_token"):
                raise ValueError("Slack connector not found or not authorized")

            bot_token = connector.data[0]["oauth_token"]

            from connectors.slack import delete_message
            result = await delete_message(channel, ts, bot_token)

            if not result.get("success"):
                raise ValueError(result.get("error", "Slack delete failed"))

        elif event["app"] == "gdocs":
            file_id = event.get("metadata", {}).get("file_id")
            revision_id = event.get("metadata", {}).get("revision_id")
            if not file_id or not revision_id:
                raise ValueError("No file_id or revision_id found in event metadata")

            connector = supabase.table("connectors") \
                .select("oauth_token") \
                .eq("app", "gdocs") \
                .eq("user_id", event.get("user_id")) \
                .execute()

            if not connector.data or not connector.data[0].get("oauth_token"):
                raise ValueError("Google Docs connector not found or not authorized")

            oauth_token = connector.data[0]["oauth_token"]

            from connectors.gdocs import restore_revision
            result = await restore_revision(file_id, revision_id, oauth_token)

            if not result.get("success"):
                raise ValueError(result.get("error", "Google Docs restore failed"))

        else:
            raise ValueError(f"Unknown app: {event['app']}")

        # ── Step 6a: Success — update records ─────────────────
        supabase.table("rollbacks").update({
            "result":       "success",
            "api_response": result,
        }).eq("id", rollback_id).execute()

        supabase.table("events").update({
            "rollback_status": "executed",
            "status":          "rolled_back",
        }).eq("id", event_id).execute()

        # ── Step 6b: Update agent trust score ─────────────────
        if event.get("agent_id"):
            await update_agent_trust(event["agent_id"])

        return {
            "rollback_id": rollback_id,
            "event_id":    event_id,
            "status":      "success",
            "result":      result,
        }

    except Exception as exc:
        failure_reason = str(exc)

        supabase.table("rollbacks").update({
            "result":         "failed",
            "failure_reason": failure_reason,
        }).eq("id", rollback_id).execute()

        supabase.table("events").update({
            "rollback_status": "failed",
        }).eq("id", event_id).execute()

        raise HTTPException(
            status_code=422,
            detail={
                "code":        "ROLLBACK_FAILED",
                "message":     failure_reason,
                "rollback_id": rollback_id,
            }
        )