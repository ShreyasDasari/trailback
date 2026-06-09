import os

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


def initiate_connection(app: str, user_id: str) -> tuple[str, str]:
    """
    Start the Composio OAuth flow for the given app.

    Returns (redirect_url, connection_request_id).
    The caller must store connection_request_id so confirm_connection() can
    call wait_for_connection() after the user completes OAuth.
    """
    callback_url = f"{_TRAILBACK_BASE_URL}/settings/connectors?connected={app}"
    client = get_client()
    # SDK v1: initiate(user_id, auth_config_id, *, callback_url=...)
    request = client.connected_accounts.initiate(
        user_id,
        auth_config_id(app),
        callback_url=callback_url,
    )
    if not request.redirect_url:
        raise RuntimeError(
            f"Composio returned no redirect URL for {app!r}. "
            "Check that the auth config ID is correct in the Composio dashboard."
        )
    return request.redirect_url, request.id


def confirm_connection(connection_request_id: str) -> str:
    """
    Called after the user completes OAuth. Waits for the connection to
    become active and returns the connected account ID (e.g. 'ca_...').
    """
    client = get_client()
    account = client.connected_accounts.wait_for_connection(
        connection_request_id, timeout=30
    )
    return account.id


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
