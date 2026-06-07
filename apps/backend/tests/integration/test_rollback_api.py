import pytest
import os
import sys
from unittest.mock import patch, MagicMock, AsyncMock

os.environ["SUPABASE_URL"] = "https://dummy.supabase.co"
os.environ["SUPABASE_ANON_KEY"] = "dummy-anon-key"
os.environ["SUPABASE_SERVICE_KEY"] = "dummy-service-key"

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from fastapi.testclient import TestClient
import main
client = TestClient(main.app)


def make_event(app_name="gmail", rollback_status="available"):
    return {
        "id": "event-uuid-123",
        "app": app_name,
        "action_type": "email.send",
        "agent_id": "test-agent",
        "user_id": "user-uuid-123",
        "risk_level": "medium",
        "risk_score": 40,
        "risk_reasons": [],
        "rollback_status": rollback_status,
        "status": "completed",
        "metadata": {"message_id": "msg_123"},
        "created_at": "2024-01-01T00:00:00"
    }


class TestRollbackAPI:

    def test_confirmation_false_returns_422(self):
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value \
            .eq.return_value.execute.return_value = MagicMock(data=[make_event()])

        with patch('main.supabase', mock_db):
            response = client.post(
                "/api/v1/rollback/event-uuid-123",
                json={"confirmation": False}
            )
        assert response.status_code == 422

    def test_event_not_found_returns_404(self):
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value \
            .eq.return_value.execute.return_value = MagicMock(data=[])

        with patch('main.supabase', mock_db):
            response = client.post(
                "/api/v1/rollback/nonexistent-id",
                json={"confirmation": True}
            )
        assert response.status_code == 404

    def test_already_executed_returns_422(self):
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value \
            .eq.return_value.execute.return_value = MagicMock(
                data=[make_event(rollback_status="executed")]
            )

        with patch('main.supabase', mock_db):
            response = client.post(
                "/api/v1/rollback/event-uuid-123",
                json={"confirmation": True}
            )
        assert response.status_code == 422

    def test_successful_gmail_rollback_returns_202(self):
        event = make_event(app_name="gmail", rollback_status="available")
        event["metadata"] = {"message_id": "msg_123"}

        mock_trash = AsyncMock(return_value={
            "success": True,
            "message_id": "msg_123",
            "labels": ["TRASH"]
        })

        def table_side_effect(table_name):
            m = MagicMock()
            if table_name == "events":
                m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[event])
                m.update.return_value.eq.return_value.execute.return_value = MagicMock()
            elif table_name == "rollbacks":
                m.insert.return_value.execute.return_value = MagicMock(data=[{"id": "rollback-uuid-123"}])
                m.update.return_value.eq.return_value.execute.return_value = MagicMock()
            elif table_name == "connectors":
                m.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[{"oauth_token": "fake-token"}]
                )
            return m

        mock_db = MagicMock()
        mock_db.table.side_effect = table_side_effect

        with patch('main.supabase', mock_db):
            with patch('connectors.gmail.trash_email', mock_trash):
                response = client.post(
                    "/api/v1/rollback/event-uuid-123",
                    json={"confirmation": True}
                )
        assert response.status_code == 202