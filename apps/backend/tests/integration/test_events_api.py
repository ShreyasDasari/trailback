import pytest
import os
import sys
from unittest.mock import patch, MagicMock

# ── Set dummy env variables BEFORE any imports ────────────────
os.environ["SUPABASE_URL"] = "https://dummy.supabase.co"
os.environ["SUPABASE_ANON_KEY"] = "dummy-anon-key"
os.environ["SUPABASE_SERVICE_KEY"] = "dummy-service-key"

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

# ── Mock Supabase before importing app ────────────────────────
mock_supabase = MagicMock()

mock_insert = MagicMock()
mock_insert.execute.return_value = MagicMock(data=[{
    "id": "test-event-uuid-123",
    "risk_level": "medium",
    "rollback_status": "available"
}])

mock_select = MagicMock()
mock_select.eq.return_value = MagicMock(
    execute=MagicMock(return_value=MagicMock(data=[]))
)

mock_supabase.table.return_value = MagicMock(
    insert=MagicMock(return_value=mock_insert),
    select=MagicMock(return_value=mock_select)
)

with patch('db.supabase_client.supabase', mock_supabase):
    from fastapi.testclient import TestClient
    from main import app

client = TestClient(app)


# ── Test Cases ────────────────────────────────────────────────

class TestEventsAPI:

    def test_post_events_valid_gmail_payload_returns_201(self):
        """POST /api/v1/events with valid Gmail payload returns 201"""
        payload = {
            "app": "gmail",
            "action_type": "email.send",
            "agent_id": "test-agent",
            "metadata": {
                "to": ["test@external.com"],
                "subject": "Test email"
            },
            "before_snapshot": {
                "content": "Hello world",
                "content_type": "text/plain"
            },
            "after_snapshot": {
                "message_id": "msg_test_001"
            }
        }

        response = client.post("/api/v1/events", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert "event_id" in data
        assert "risk_level" in data
        assert data["risk_level"] in ("low", "medium", "high", "critical")

    def test_post_events_missing_app_returns_422(self):
        """POST /api/v1/events with missing app field returns 422"""
        payload = {
            "action_type": "email.send",
            "metadata": {"to": ["test@external.com"]}
        }

        response = client.post("/api/v1/events", json=payload)

        assert response.status_code == 422