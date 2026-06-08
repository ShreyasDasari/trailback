import os
import threading

from composio import Composio as _ComposioSDK

_AUTH_CONFIG_IDS: dict[str, str] = {
    "gmail": "ac_u-Ckzzc9dnQD",
    "gdocs": "ac_CsXHhod4Qrf2",
    "slack": "ac_eWiREHpaZZZe",
}

_lock = threading.Lock()
_client: _ComposioSDK | None = None


def get_client() -> _ComposioSDK:
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                api_key = os.environ.get("COMPOSIO_API_KEY")
                if not api_key:
                    raise RuntimeError("COMPOSIO_API_KEY env var is not set")
                _client = _ComposioSDK(api_key=api_key)
    return _client


def auth_config_id(app: str) -> str:
    try:
        return _AUTH_CONFIG_IDS[app]
    except KeyError:
        raise ValueError(f"Unknown app: {app!r}")
