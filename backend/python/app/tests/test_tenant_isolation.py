import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services import db


@pytest.mark.asyncio
async def test_tenant_transaction_degrades_gracefully_without_pool(monkeypatch):
    """When DB pool is unavailable, tenant_transaction yields None safely."""
    monkeypatch.setattr(db, "get_pool", AsyncMock(return_value=None))

    async with db.tenant_transaction("user-123") as conn:
        assert conn is None


@pytest.mark.asyncio
async def test_tenant_transaction_sets_session_claim(monkeypatch):
    """When pool is active, tenant_transaction sets request.jwt.claim.sub."""
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock()

    class MockTransaction:
        async def __aenter__(self):
            return mock_conn

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    mock_conn.transaction = MagicMock(return_value=MockTransaction())

    class MockPoolAcquire:
        async def __aenter__(self):
            return mock_conn

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(return_value=MockPoolAcquire())
    monkeypatch.setattr(db, "get_pool", AsyncMock(return_value=mock_pool))

    async with db.tenant_transaction("user-456") as conn:
        assert conn is mock_conn
        mock_conn.execute.assert_awaited_once_with(
            "SELECT set_config('request.jwt.claim.sub', $1, true)", "user-456"
        )


@pytest.mark.asyncio
async def test_tenant_transaction_skips_synthetic_identity(monkeypatch):
    """Synthetic identities must never set claim."""
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock()

    class MockTransaction:
        async def __aenter__(self):
            return mock_conn

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    mock_conn.transaction = MagicMock(return_value=MockTransaction())

    class MockPoolAcquire:
        async def __aenter__(self):
            return mock_conn

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(return_value=MockPoolAcquire())
    monkeypatch.setattr(db, "get_pool", AsyncMock(return_value=mock_pool))

    async with db.tenant_transaction("default_user") as conn:
        assert conn is mock_conn
        mock_conn.execute.assert_not_awaited()
