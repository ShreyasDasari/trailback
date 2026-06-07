import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestSlackConnector:

    @pytest.mark.asyncio
    async def test_delete_message_success(self):
        """Success path — Slack API returns ok: true"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ok": True}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=MagicMock(
                post=AsyncMock(return_value=mock_response)
            ))
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)

            from connectors.slack import delete_message
            result = await delete_message("C123", "1234567890.123456", "fake-token")

        assert result["success"] is True
        assert result["channel"] == "C123"
        assert result["ts"] == "1234567890.123456"

    @pytest.mark.asyncio
    async def test_delete_message_api_error(self):
        """Slack API returns non-200 — should return success: False"""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=MagicMock(
                post=AsyncMock(return_value=mock_response)
            ))
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)

            from connectors.slack import delete_message
            result = await delete_message("C123", "1234567890.123456", "fake-token")

        assert result["success"] is False
        assert "500" in result["error"]

    @pytest.mark.asyncio
    async def test_delete_message_msg_too_old(self):
        """Slack returns msg_too_old — should return clear plain-English error"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ok": False, "error": "msg_too_old"}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=MagicMock(
                post=AsyncMock(return_value=mock_response)
            ))
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)

            from connectors.slack import delete_message
            result = await delete_message("C123", "1234567890.123456", "fake-token")

        assert result["success"] is False
        assert "24" in result["error"]  # mentions 24 hours
        assert "old" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_delete_message_missing_token(self):
        """Empty token — should not crash, returns success: False"""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(side_effect=Exception("Invalid token"))
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)

            from connectors.slack import delete_message
            result = await delete_message("C123", "1234567890.123456", "")

        assert result["success"] is False
        assert "error" in result