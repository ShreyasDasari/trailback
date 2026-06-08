import os
from typing import Optional

from connectors.composio_client import get_client, auth_config_id

_TRAILBACK_BASE_URL = os.environ.get(
    "TRAILBACK_BASE_URL", "https://trailback-ai.vercel.app"
)

# Composio action names for each supported app
_ROLLBACK_ACTIONS: dict[str, str] = {
    "gmail": "GMAIL_MOVE_TO_TRASH",
    "slack": "SLACK_DELETES_A_MESSAGE_FROM_A_CHAT",
    # gdocs: no supported Composio action — callers must handle acknowledged=True
}


def initiate_connection(app: str, user_id: str) -> str:
    """
    Start the Composio OAuth flow for the given app.

    Returns the redirect URL to send the user's browser to.
    After the user completes OAuth, Composio redirects back to
    /settings/connectors?connected={app}.
    """
    callback_url = f"{_TRAILBACK_BASE_URL}/settings/connectors?connected={app}"
    client = get_client()
    request = client.connected_accounts.initiate(
        integration_id=auth_config_id(app),
        entity_id=user_id,
        redirect_url=callback_url,
    )
    redirect = getattr(request, "redirectUrl", None) or getattr(request, "redirect_url", None)
    if not redirect:
        raise RuntimeError(
            f"Composio returned no redirect URL for {app!r}. "
            "Check that the auth config ID is correct in the Composio dashboard."
        )
    return redirect


def get_composio_account_id(app: str, user_id: str) -> Optional[str]:
    """
    Query Composio for the active connected account ID for this user + app.

    Returns the account ID (e.g. "ca_abc123") or None if not found.
    Call this after the user completes the OAuth redirect.
    """
    client = get_client()
    try:
        accounts = client.connected_accounts.list(entity_id=user_id)
    except TypeError:
        # Older SDK versions don't accept entity_id — filter manually
        accounts = [
            a for a in client.connected_accounts.list()
            if getattr(a, "entityId", None) == user_id
        ]

    app_lower = app.lower()
    for account in accounts:
        account_app = (getattr(account, "appName", None) or "").lower()
        status = (getattr(account, "status", "") or "").upper()
        if account_app == app_lower and status == "ACTIVE":
            return account.id

    return None


def execute_action(
    app: str,
    metadata: dict,
    user_id: str,
    connected_account_id: str,
) -> dict:
    """
    Execute a rollback action via Composio.

    Returns a dict with one of:
      {"success": True, "api_response": ...}
      {"success": False, "error": "..."}
      {"success": False, "acknowledged": True, "reason": "..."} — for gdocs
    """
    if app == "gdocs":
        # No Composio action exists for Google Drive revision restore.
        # The rollback worker should mark this as ACKNOWLEDGED.
        return {
            "success": False,
            "acknowledged": True,
            "reason": "gdocs_no_composio_action",
        }

    action_name = _ROLLBACK_ACTIONS.get(app)
    if not action_name:
        return {"success": False, "error": f"No Composio action configured for app={app!r}"}

    if app == "gmail":
        message_id = metadata.get("message_id")
        if not message_id:
            return {"success": False, "error": "No message_id in event metadata"}
        params = {"message_id": message_id}

    elif app == "slack":
        channel = metadata.get("channel")
        ts = metadata.get("ts")
        if not channel or not ts:
            return {"success": False, "error": "No channel or ts in event metadata"}
        params = {"channel": channel, "ts": ts}

    else:
        return {"success": False, "error": f"Unhandled app: {app!r}"}

    client = get_client()
    result = client.use(
        action=action_name,
        params=params,
        entity_id=user_id,
        connected_account=connected_account_id,
    )
    return {"success": True, "api_response": result}
