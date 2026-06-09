"""
tests/test_connectors.py — Composio connector endpoint tests.

Covers:
  - POST /connectors/link  → initiate OAuth, store request ID, return redirect_url
  - POST /connectors/confirm/{app} → wait_for_connection, store composio_account_id

All external calls (Composio SDK, Supabase) are mocked.
"""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app, raise_server_exceptions=False)

_COMPOSIO_ENV = {"TRAILBACK_USE_COMPOSIO": "true", "COMPOSIO_API_KEY": "test-key"}
_COMPOSIO_OFF = {"TRAILBACK_USE_COMPOSIO": "false"}


def _mock_user(user_id: str = "user-123", email: str = "test@example.com"):
    user = MagicMock()
    user.id = user_id
    user.email = email
    resp = MagicMock()
    resp.user = user
    return resp


def _auth_headers():
    return {"Authorization": "Bearer valid-token"}


def _mock_db_no_row():
    """Supabase mock that returns no existing connector row."""
    m = MagicMock()
    m.table.return_value.select.return_value \
        .eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    m.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    return m


def _mock_db_with_row(token: str = "cr:req-abc123"):
    """Supabase mock that returns one existing connector row."""
    m = MagicMock()
    m.table.return_value.select.return_value \
        .eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"id": "conn-uuid", "oauth_token": token}]
        )
    m.table.return_value.update.return_value \
        .eq.return_value.execute.return_value = MagicMock(data=[])
    return m


# ─────────────────────────────────────────────────────────────
# POST /connectors/link
# ─────────────────────────────────────────────────────────────

class TestConnectorLink:
    def test_missing_auth_returns_401(self):
        response = client.post("/api/v1/connectors/link", json={"app": "gmail"})
        assert response.status_code == 401

    def test_unknown_app_returns_400(self):
        with patch("api.deps.supabase") as mock_supabase:
            mock_supabase.auth.get_user.return_value = _mock_user()
            response = client.post(
                "/api/v1/connectors/link",
                json={"app": "notion"},
                headers=_auth_headers(),
            )
        assert response.status_code == 400

    def test_composio_disabled_returns_501(self):
        with patch("api.deps.supabase") as mock_supabase, \
             patch.dict(os.environ, _COMPOSIO_OFF):
            mock_supabase.auth.get_user.return_value = _mock_user()
            response = client.post(
                "/api/v1/connectors/link",
                json={"app": "gmail"},
                headers=_auth_headers(),
            )
        assert response.status_code == 501

    @pytest.mark.parametrize("app_name", ["gmail", "gdocs", "slack"])
    def test_valid_app_returns_redirect_url(self, app_name):
        fake_url = f"https://composio.dev/oauth?app={app_name}&token=abc"
        with patch("api.deps.supabase") as mock_supabase, \
             patch("main.supabase", _mock_db_no_row()), \
             patch("connectors.composio_executor.initiate_connection",
                   return_value=(fake_url, "req-123")), \
             patch.dict(os.environ, _COMPOSIO_ENV):
            mock_supabase.auth.get_user.return_value = _mock_user()
            response = client.post(
                "/api/v1/connectors/link",
                json={"app": app_name},
                headers=_auth_headers(),
            )
        assert response.status_code == 200
        assert response.json()["redirect_url"] == fake_url

    def test_composio_error_returns_502(self):
        with patch("api.deps.supabase") as mock_supabase, \
             patch("connectors.composio_executor.initiate_connection") as mock_init, \
             patch.dict(os.environ, _COMPOSIO_ENV):
            mock_supabase.auth.get_user.return_value = _mock_user()
            mock_init.side_effect = RuntimeError("Composio unreachable")
            response = client.post(
                "/api/v1/connectors/link",
                json={"app": "gmail"},
                headers=_auth_headers(),
            )
        assert response.status_code == 502


# ─────────────────────────────────────────────────────────────
# POST /connectors/confirm/{app}
# ─────────────────────────────────────────────────────────────

class TestConnectorConfirm:
    def test_missing_auth_returns_401(self):
        response = client.post("/api/v1/connectors/confirm/gmail")
        assert response.status_code == 401

    def test_unknown_app_returns_400(self):
        with patch("api.deps.supabase") as mock_supabase:
            mock_supabase.auth.get_user.return_value = _mock_user()
            response = client.post(
                "/api/v1/connectors/confirm/notion",
                headers=_auth_headers(),
            )
        assert response.status_code == 400

    def test_composio_disabled_returns_501(self):
        with patch("api.deps.supabase") as mock_supabase, \
             patch.dict(os.environ, _COMPOSIO_OFF):
            mock_supabase.auth.get_user.return_value = _mock_user()
            response = client.post(
                "/api/v1/connectors/confirm/gmail",
                headers=_auth_headers(),
            )
        assert response.status_code == 501

    def test_no_pending_row_returns_400(self):
        with patch("api.deps.supabase") as mock_supabase, \
             patch("main.supabase", _mock_db_no_row()), \
             patch.dict(os.environ, _COMPOSIO_ENV):
            mock_supabase.auth.get_user.return_value = _mock_user()
            response = client.post(
                "/api/v1/connectors/confirm/gmail",
                headers=_auth_headers(),
            )
        assert response.status_code == 400

    def test_composio_sdk_error_returns_502(self):
        with patch("api.deps.supabase") as mock_supabase, \
             patch("main.supabase", _mock_db_with_row("cr:req-abc")), \
             patch("connectors.composio_executor.confirm_connection") as mock_confirm, \
             patch.dict(os.environ, _COMPOSIO_ENV):
            mock_supabase.auth.get_user.return_value = _mock_user()
            mock_confirm.side_effect = Exception("SDK timeout")
            response = client.post(
                "/api/v1/connectors/confirm/gmail",
                headers=_auth_headers(),
            )
        assert response.status_code == 502

    def test_confirm_stores_account_id(self):
        with patch("api.deps.supabase") as mock_supabase, \
             patch("main.supabase", _mock_db_with_row("cr:req-abc")), \
             patch("connectors.composio_executor.confirm_connection",
                   return_value="ca_abc123"), \
             patch.dict(os.environ, _COMPOSIO_ENV):
            mock_supabase.auth.get_user.return_value = _mock_user()
            response = client.post(
                "/api/v1/connectors/confirm/gmail",
                headers=_auth_headers(),
            )
        assert response.status_code == 200
        assert response.json() == {"status": "connected", "app": "gmail"}

    def test_confirm_slack_stores_account_id(self):
        with patch("api.deps.supabase") as mock_supabase, \
             patch("main.supabase", _mock_db_with_row("cr:req-slack")), \
             patch("connectors.composio_executor.confirm_connection",
                   return_value="ca_slack456"), \
             patch.dict(os.environ, _COMPOSIO_ENV):
            mock_supabase.auth.get_user.return_value = _mock_user()
            response = client.post(
                "/api/v1/connectors/confirm/slack",
                headers=_auth_headers(),
            )
        assert response.status_code == 200
        assert response.json()["app"] == "slack"
