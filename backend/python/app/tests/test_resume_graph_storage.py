"""Tests for resume_graph_storage module.

The tests mock the asyncpg pool to avoid a real database.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services import resume_graph_storage

class MockAsyncContextManager:
    def __init__(self, conn):
        self.conn = conn
    async def __aenter__(self):
        return self.conn
    async def __aexit__(self, exc_type, exc, tb):
        pass

@pytest.fixture
def mock_pool():
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock()
    mock_conn.fetchrow = AsyncMock()
    
    mock_pool_obj = MagicMock()
    mock_pool_obj.acquire.return_value = MockAsyncContextManager(mock_conn)
    return mock_pool_obj, mock_conn

@pytest.mark.asyncio
async def test_store_graph_success(mock_pool):
    mock_pool_obj, mock_conn = mock_pool
    with patch('app.services.resume_graph_storage.get_pool', AsyncMock(return_value=mock_pool_obj)):
        await resume_graph_storage.store_graph('run-123', {'nodes': []}, 'user-abc')
        mock_pool_obj.acquire.assert_called_once()
        mock_conn.execute.assert_awaited()

@pytest.mark.asyncio
async def test_load_graph_found(mock_pool):
    mock_pool_obj, mock_conn = mock_pool
    mock_conn.fetchrow.return_value = {'graph': {'nodes': [1, 2]}}
    with patch('app.services.resume_graph_storage.get_pool', AsyncMock(return_value=mock_pool_obj)):
        result = await resume_graph_storage.load_graph('run-123', 'user-abc')
        assert result == {'nodes': [1, 2]}
        mock_conn.fetchrow.assert_awaited_with('SELECT graph FROM resume_graphs WHERE run_id = $1 AND user_id = $2', 'run-123', 'user-abc')

@pytest.mark.asyncio
async def test_load_graph_not_found(mock_pool):
    mock_pool_obj, mock_conn = mock_pool
    mock_conn.fetchrow.return_value = None
    with patch('app.services.resume_graph_storage.get_pool', AsyncMock(return_value=mock_pool_obj)):
        result = await resume_graph_storage.load_graph('run-404', 'user-abc')
        assert result is None

@pytest.mark.asyncio
async def test_delete_graph_success(mock_pool):
    mock_pool_obj, mock_conn = mock_pool
    with patch('app.services.resume_graph_storage.get_pool', AsyncMock(return_value=mock_pool_obj)):
        await resume_graph_storage.delete_graph('run-123', 'user-abc')
        mock_pool_obj.acquire.assert_called_once()
        mock_conn.execute.assert_awaited()
