# ─────────────────────────────────────────────────────────────
# Trailback — Event Pydantic Models
# Validates all incoming event payloads from the extension.
# ─────────────────────────────────────────────────────────────

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from uuid import uuid4


class SnapshotPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    content: Optional[str] = None
    content_type: Optional[str] = "text/plain"
    requests: Optional[Any] = None
    captured_at: Optional[str] = None



class EventPayload(BaseModel):
    idempotency_key: str = Field(
        default_factory=lambda: str(uuid4())
    )
    agent_id: str = "unknown"
    app: str
    action_type: str
    intent: Optional[str] = None
    metadata: Dict[str, Any] = {}
    before_snapshot: Optional[SnapshotPayload] = None
    after_snapshot: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None