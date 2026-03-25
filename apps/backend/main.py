# ─────────────────────────────────────────────────────────────
# Trailback — FastAPI Backend
# ─────────────────────────────────────────────────────────────

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from db.supabase_client import supabase
from core.risk_classifier import classify_event
from models.event import EventPayload
from api.deps import get_current_user
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import hashlib
import json
import csv
import io
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
# Health Check — no auth required
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
async def ingest_event(
    payload: EventPayload,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

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
        before=payload.before_snapshot.model_dump() if payload.before_snapshot else None,
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
        "user_id":          user_id,
    }).execute()

    if not event_insert.data:
        raise HTTPException(status_code=500, detail="Failed to insert event")

    event_id = event_insert.data[0]["id"]

    # ── Step 4: Insert before snapshot ────────────────────────
    if payload.before_snapshot and payload.before_snapshot.content:
        before_content = payload.before_snapshot.model_dump()
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
    risk_level: str = None,
    from_date: str = None,
    to_date: str = None,
    current_user: dict = Depends(get_current_user)
):
    query = supabase.table("events") \
        .select("*") \
        .eq("user_id", current_user["user_id"]) \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1)

    if app:
        query = query.eq("app", app)
    if risk_level:
        query = query.eq("risk_level", risk_level)
    if from_date:
        query = query.gte("created_at", from_date)
    if to_date:
        query = query.lte("created_at", to_date)

    result = query.execute()

    return {
        "events":   result.data or [],
        "limit":    limit,
        "offset":   offset,
        "has_more": len(result.data or []) == limit
    }


# ─────────────────────────────────────────────────────────────
# GET /events/{event_id} — Single event detail
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/events/{event_id}")
async def get_event(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    result = supabase.table("events") \
        .select("*") \
        .eq("id", event_id) \
        .eq("user_id", current_user["user_id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    return result.data[0]


# ─────────────────────────────────────────────────────────────
# GET /events/{event_id}/diff — Before/after diff
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/events/{event_id}/diff")
async def get_diff(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    event_result = supabase.table("events") \
        .select("*") \
        .eq("id", event_id) \
        .eq("user_id", current_user["user_id"]) \
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
# Request model for rollback
# ─────────────────────────────────────────────────────────────

class RollbackRequest(BaseModel):
    confirmation: bool
    reason: Optional[str] = None


# ─────────────────────────────────────────────────────────────
# POST /rollback/{event_id} — Execute rollback
# ─────────────────────────────────────────────────────────────

@app.post("/api/v1/rollback/{event_id}", status_code=202)
async def initiate_rollback(
    event_id: str,
    payload: RollbackRequest,
    current_user: dict = Depends(get_current_user)
):
    if not payload.confirmation:
        raise HTTPException(
            status_code=422,
            detail="Rollback requires confirmation: true"
        )

    event_result = supabase.table("events") \
        .select("*") \
        .eq("id", event_id) \
        .eq("user_id", current_user["user_id"]) \
        .execute()

    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    event = event_result.data[0]

    if event["rollback_status"] != "available":
        raise HTTPException(
            status_code=422,
            detail={
                "code":            "ROLLBACK_UNAVAILABLE",
                "message":         f"This event cannot be rolled back. Current status: {event['rollback_status']}",
                "rollback_status": event["rollback_status"]
            }
        )

    rollback_insert = supabase.table("rollbacks").insert({
        "event_id":     event_id,
        "user_id":      current_user["user_id"],
        "initiated_by": "user",
        "result":       "pending",
    }).execute()

    rollback_id = rollback_insert.data[0]["id"]

    result = None
    failure_reason = None

    try:
        if event["app"] == "gmail":
            message_id = event.get("metadata", {}).get("message_id")
            if not message_id:
                raise ValueError("No message_id found in event metadata")

            connector = supabase.table("connectors") \
                .select("oauth_token") \
                .eq("app", "gmail") \
                .eq("user_id", current_user["user_id"]) \
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

        supabase.table("rollbacks").update({
            "result":       "success",
            "api_response": result,
        }).eq("id", rollback_id).execute()

        supabase.table("events").update({
            "rollback_status": "executed",
            "status":          "rolled_back",
        }).eq("id", event_id).execute()

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


# ─────────────────────────────────────────────────────────────
# GET /rollback/{rollback_id}/status — Poll rollback result
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/rollback/{rollback_id}/status")
async def get_rollback_status(
    rollback_id: str,
    current_user: dict = Depends(get_current_user)
):
    result = supabase.table("rollbacks") \
        .select("id, event_id, result, failure_reason, api_response, executed_at") \
        .eq("id", rollback_id) \
        .eq("user_id", current_user["user_id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Rollback not found")

    row = result.data[0]

    return {
        "rollback_id":    row["id"],
        "event_id":       row["event_id"],
        "result":         row["result"],
        "failure_reason": row["failure_reason"],
        "api_response":   row["api_response"],
        "executed_at":    row["executed_at"],
    }


# ─────────────────────────────────────────────────────────────
# GET /connectors — List connected apps
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/connectors")
async def get_connectors(
    current_user: dict = Depends(get_current_user)
):
    result = supabase.table("connectors") \
        .select("app, is_active, scopes, connected_at, last_used_at") \
        .eq("user_id", current_user["user_id"]) \
        .execute()

    connected = {row["app"]: row for row in (result.data or [])}

    connectors = []
    for app_name in ["gmail", "gdocs", "slack"]:
        if app_name in connected:
            row = connected[app_name]
            connectors.append({
                "app":          app_name,
                "is_active":    row["is_active"],
                "scopes":       row["scopes"],
                "connected_at": row["connected_at"],
                "last_used_at": row["last_used_at"],
            })
        else:
            connectors.append({
                "app":          app_name,
                "is_active":    False,
                "scopes":       None,
                "connected_at": None,
                "last_used_at": None,
            })

    return {"connectors": connectors}


# ─────────────────────────────────────────────────────────────
# DELETE /connectors/{app} — Disconnect an app
# ─────────────────────────────────────────────────────────────

@app.delete("/api/v1/connectors/{app_name}", status_code=204)
async def delete_connector(
    app_name: str,
    current_user: dict = Depends(get_current_user)
):
    supabase.table("connectors") \
        .delete() \
        .eq("app", app_name) \
        .eq("user_id", current_user["user_id"]) \
        .execute()


# ─────────────────────────────────────────────────────────────
# GET /agents — List registered agents
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/agents")
async def get_agents(
    current_user: dict = Depends(get_current_user)
):
    result = supabase.table("agents") \
        .select("id, name, agent_key, total_actions, rolled_back, trust_score, created_at") \
        .eq("user_id", current_user["user_id"]) \
        .execute()

    return {"agents": result.data or []}


# ─────────────────────────────────────────────────────────────
# POST /agents — Register a new agent
# ─────────────────────────────────────────────────────────────

class AgentRequest(BaseModel):
    name: str


@app.post("/api/v1/agents", status_code=201)
async def create_agent(
    payload: AgentRequest,
    current_user: dict = Depends(get_current_user)
):
    result = supabase.table("agents").insert({
        "user_id":      current_user["user_id"],
        "name":         payload.name,
        "total_actions": 0,
        "rolled_back":  0,
        "trust_score":  1.0,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create agent")

    agent = result.data[0]

    return {
        "id":          agent["id"],
        "name":        agent["name"],
        "agent_key":   agent["agent_key"],
        "trust_score": agent["trust_score"],
        "created_at":  agent["created_at"],
    }


# ─────────────────────────────────────────────────────────────
# GET /audit — CSV export
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/audit")
async def get_audit(
    from_date: str = None,
    to_date: str = None,
    current_user: dict = Depends(get_current_user)
):
    query = supabase.table("events") \
        .select("id, created_at, agent_id, app, action_type, risk_level, rollback_status, metadata") \
        .eq("user_id", current_user["user_id"]) \
        .order("created_at", desc=True)

    if from_date:
        query = query.gte("created_at", from_date)
    if to_date:
        query = query.lte("created_at", to_date)

    result = query.execute()
    events = result.data or []

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "event_id", "timestamp", "agent_id", "app",
        "action_type", "risk_level", "rollback_status", "metadata_summary"
    ])

    for event in events:
        metadata = event.get("metadata", {})
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except Exception:
                metadata = {}

        summary_parts = []
        if metadata.get("to"):
            summary_parts.append(f"To: {', '.join(metadata['to'])}")
        if metadata.get("subject"):
            summary_parts.append(f"Subject: {metadata['subject']}")
        if metadata.get("channel"):
            summary_parts.append(f"Channel: {metadata['channel']}")
        if metadata.get("file_name"):
            summary_parts.append(f"File: {metadata['file_name']}")
        metadata_summary = " | ".join(summary_parts)

        writer.writerow([
            event["id"],
            event["created_at"],
            event["agent_id"],
            event["app"],
            event["action_type"],
            event["risk_level"],
            event["rollback_status"],
            metadata_summary,
        ])

    output.seek(0)
    date_str = datetime.utcnow().strftime("%Y-%m")

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=trailback-audit-{date_str}.csv"
        }
    )

# ─────────────────────────────────────────────────────────────
# POST /connectors/upsert — Store OAuth token after user connects an app
# ─────────────────────────────────────────────────────────────

class ConnectorUpsertRequest(BaseModel):
    app: str
    oauth_token: str
    refresh_token: Optional[str] = None
    scopes: Optional[list] = None

@app.post("/api/v1/connectors/upsert", status_code=200)
async def upsert_connector(
    payload: ConnectorUpsertRequest,
    current_user: dict = Depends(get_current_user)
):
    existing = supabase.table("connectors") \
        .select("id") \
        .eq("user_id", current_user["user_id"]) \
        .eq("app", payload.app) \
        .execute()

    if existing.data:
        supabase.table("connectors") \
            .update({
                "oauth_token":   payload.oauth_token,
                "refresh_token": payload.refresh_token,
                "scopes":        payload.scopes,
                "is_active":     True,
                "last_used_at":  datetime.utcnow().isoformat(),
            }) \
            .eq("id", existing.data[0]["id"]) \
            .execute()
    else:
        supabase.table("connectors") \
            .insert({
                "user_id":       current_user["user_id"],
                "app":           payload.app,
                "oauth_token":   payload.oauth_token,
                "refresh_token": payload.refresh_token,
                "scopes":        payload.scopes,
                "is_active":     True,
            }) \
            .execute()

    return {"status": "connected", "app": payload.app}