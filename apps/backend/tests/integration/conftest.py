import pytest
from unittest.mock import MagicMock


@pytest.fixture(autouse=True)
def reset_supabase_mock():
    """Reset supabase mock before every integration test automatically"""
    from tests.integration import test_rollback_api
    from tests.integration import test_events_api

    for module in [test_rollback_api, test_events_api]:
        if hasattr(module, 'mock_supabase'):
            module.mock_supabase.reset_mock()
            module.mock_supabase.table.side_effect = None
    yield