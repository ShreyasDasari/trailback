"""
tests/test_auth.py — JWT authentication tests for the FastAPI backend.

These tests verify that:
  - Missing Authorization header → 401
  - Malformed / invalid token → 401
  - Valid token → request passes through (mocked)

All Supabase calls are mocked — no live DB required.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app

client = TestClient(app, raise_server_exceptions=False)

PROTECTED_ENDPOINTS = [
    ("GET",  "/api/v1/timeline"),
    ("GET",  "/api/v1/connectors"),
    ("GET",  "/api/v1/agents"),
]


class TestMissingToken:
    @pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
    def test_no_auth_header_returns_401(self, method, path):
        response = client.request(method, path)
        assert response.status_code == 401

    def test_events_no_auth_returns_401(self):
        response = client.post("/api/v1/events", json={
            "app": "gmail",
            "action_type": "email.send",
            "metadata": {},
        })
        assert response.status_code == 401


class TestInvalidToken:
    @pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
    def test_invalid_token_returns_401(self, method, path):
        with patch("api.deps.supabase") as mock_supabase:
            mock_supabase.auth.get_user.return_value = MagicMock(user=None)
            response = client.request(method, path, headers={"Authorization": "Bearer not-a-real-token"})
        assert response.status_code == 401
        assert "Invalid or expired token" in response.json()["detail"]

    def test_exception_from_supabase_returns_401(self):
        with patch("api.deps.supabase") as mock_supabase:
            mock_supabase.auth.get_user.side_effect = Exception("network error")
            response = client.get("/api/v1/timeline", headers={"Authorization": "Bearer bad"})
        assert response.status_code == 401

    def test_rollback_invalid_token_returns_401(self):
        with patch("api.deps.supabase") as mock_supabase:
            mock_supabase.auth.get_user.return_value = MagicMock(user=None)
            response = client.post(
                "/api/v1/rollback/some-event-id",
                json={"confirmation": True},
                headers={"Authorization": "Bearer bad"},
            )
        assert response.status_code == 401


class TestValidToken:
    def _mock_user(self, user_id="test-user-123", email="test@example.com"):
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_user.email = email
        mock_response = MagicMock()
        mock_response.user = mock_user
        return mock_response

    def test_valid_token_reaches_timeline(self):
        with patch("api.deps.supabase") as mock_deps_supabase, \
             patch("main.supabase") as mock_main_supabase:

            mock_deps_supabase.auth.get_user.return_value = self._mock_user()
            mock_main_supabase.table.return_value.select.return_value \
                .eq.return_value.order.return_value \
                .range.return_value.execute.return_value = MagicMock(data=[])

            response = client.get(
                "/api/v1/timeline",
                headers={"Authorization": "Bearer valid-token"},
            )

        assert response.status_code == 200
        assert "events" in response.json()

    def test_valid_token_reaches_connectors(self):
        with patch("api.deps.supabase") as mock_deps_supabase, \
             patch("main.supabase") as mock_main_supabase:

            mock_deps_supabase.auth.get_user.return_value = self._mock_user()
            mock_main_supabase.table.return_value.select.return_value \
                .eq.return_value.execute.return_value = MagicMock(data=[])

            response = client.get(
                "/api/v1/connectors",
                headers={"Authorization": "Bearer valid-token"},
            )

        assert response.status_code == 200
        assert "connectors" in response.json()

    def test_health_requires_no_auth(self):
        with patch("main.supabase") as mock_supabase:
            mock_supabase.table.return_value.select.return_value \
                .limit.return_value.execute.return_value = MagicMock(data=[])
            response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json()["status"] in ("healthy", "degraded")
