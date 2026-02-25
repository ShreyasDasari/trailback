from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.supabase_client import supabase
from datetime import datetime
import os

app = FastAPI(title="Trailback API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
async def health():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/api/v1/events", status_code=201)
async def ingest_event(payload: dict):
    result = supabase.table("events").insert({
        "agent_id": payload.get("agent_id", "unknown"),
        "app": payload.get("app"),
        "action_type": payload.get("action_type"),
        "metadata": payload.get("metadata", {}),
        "user_id": payload.get("user_id"),
    }).execute()
    return {"event_id": result.data[0]["id"], "status": "ok"}