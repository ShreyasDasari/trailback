# ─────────────────────────────────────────────────────────────
# Trailback — FastAPI Backend
# ─────────────────────────────────────────────────────────────

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from db.supabase_client import supabase
from core.risk_classifier import classify_event
from models.event import EventPayload
from datetime import datetime
import hashlib
import json
import os

app = FastAPI(title="Trailback API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
    # If this event was already ingested, return the existing one
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