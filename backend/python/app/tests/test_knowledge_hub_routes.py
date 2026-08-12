from unittest import mock

import pytest
from fastapi import HTTPException

from app.api.knowledge_hub import KnowledgeQueryRequest, query_knowledge_hub


TEST_USER_ID = "00000000-0000-0000-0000-0000000000aa"


@pytest.mark.asyncio
async def test_query_returns_storage_unavailable_when_durable_store_is_down():
    """Candidate-facing RAG must not conceal a durable-store outage as a 502."""
    service = mock.Mock()
    service.query_knowledge_rag = mock.AsyncMock(
        side_effect=RuntimeError("knowledge_store_unavailable")
    )

    with mock.patch("app.api.knowledge_hub.get_omnisave_service", return_value=service):
        with pytest.raises(HTTPException) as captured:
            await query_knowledge_hub(
                payload=KnowledgeQueryRequest(query="What did I save?"),
                user_id=TEST_USER_ID,
            )

    assert captured.value.status_code == 503
    assert captured.value.detail == "knowledge_store_unavailable"
