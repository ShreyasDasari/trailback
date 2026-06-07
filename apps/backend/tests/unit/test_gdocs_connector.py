import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestGdocsConnector:

    @pytest.mark.asyncio
    async def test_restore_revision_success(self):
        """Success path — Drive API returns 200"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "revision-123",
            "kind": "drive#revision"
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=MagicMock(
                patch=AsyncMock(return_value=mock_response)
            ))
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)

            from connectors.gdocs import restore_revision
            result = await restore_revision("file-123", "revision-123", "fake-token")

        assert result["success"] is True
        assert result["file_id"] == "file-123"
        assert result["revision_id"] == "revision-123"

    @pytest.mark.asyncio
    async def test_restore_revision_api_error(self):
        """Drive API returns non-200 — should return success: False"""
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = "Forbidden"

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=MagicMock(
                patch=AsyncMock(return_value=mock_response)
            ))
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)

            from connectors.gdocs import restore_revision
            result = await restore_revision("file-123", "revision-123", "fake-token")

        assert result["success"] is False
        assert "403" in result["error"]

    @pytest.mark.asyncio
    async def test_restore_revision_missing_token(self):
        """Empty token — should still not crash, returns success: False"""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(side_effect=Exception("Invalid token"))
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)

            from connectors.gdocs import restore_revision
            result = await restore_revision("file-123", "revision-123", "")

        assert result["success"] is False
        assert "error" in result