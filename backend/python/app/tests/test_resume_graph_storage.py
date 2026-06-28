"""Tests for resume_graph_storage module.

The tests mock the asyncpg pool to avoid a real database.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services import resume_graph_storage

@pytest.fixture
def mock_pool():
    # Mock connection with execute and fetchrow methods
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock()
    mock_conn.fetchrow = AsyncMock()
    # Async context manager for acquire()
    mock_acquire = AsyncMock()
    mock_acquire.__aenter__.return_value = mock_conn
    mock_acquire.__aexit__.return_value = AsyncMock()
    # Mock pool with acquire method returning the context manager
    mock_pool = MagicMock()
    mock_pool.acquire = AsyncMock(return_value=mock_acquire)
    return mock_pool, mock_conn

@pytest.mark.asyncio
async def test_store_graph_success(mock_pool):
    mock_pool_obj, _ = mock_pool
    with patch('app.services.resume_graph_storage.get_pool', AsyncMock(return_value=mock_pool_obj)):
        await resume_graph_storage.store_graph('run-123', {'nodes': []})
        # Ensure acquire was awaited and execute called
        mock_pool_obj.acquire.assert_awaited()
        conn = mock_pool_obj.acquire.return_value.__aenter__.return_value
        conn.execute.assert_awaited()

@pytest.mark.asyncio
async def test_load_graph_found(mock_pool):
    mock_pool_obj, mock_conn = mock_pool
    mock_conn.fetchrow.return_value = {'graph': {'nodes': [1, 2]}}
    with patch('app.services.resume_graph_storage.get_pool', AsyncMock(return_value=mock_pool_obj)):
        result = await resume_graph_storage.load_graph('run-123')
        assert result == {'nodes': [1, 2]}
        mock_conn.fetchrow.assert_awaited_with('SELECT graph FROM resume_graphs WHERE run_id = $1', 'run-123')

@pytest.mark.asyncio
async def test_load_graph_not_found(mock_pool):
    mock_pool_obj, mock_conn = mock_pool
    mock_conn.fetchrow.return_value = None
    with patch('app.services.resume_graph_storage.get_pool', AsyncMock(return_value=mock_pool_obj)):
        result = await resume_graph_storage.load_graph('run-404')
        assert result is None

@pytest.mark.asyncio
async def test_delete_graph_success(mock_pool):
    mock_pool_obj, _ = mock_pool
    with patch('app.services.resume_graph_storage.get_pool', AsyncMock(return_value=mock_pool_obj)):
        await resume_graph_storage.delete_graph('run-123')
        mock_pool_obj.acquire.assert_awaited()
        conn = mock_pool_obj.acquire.return_value.__aenter__.return_value
        conn.execute.assert_awaited()
