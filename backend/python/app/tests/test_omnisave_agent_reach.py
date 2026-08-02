import pytest
import asyncio
from app.services.omnisave_service import get_omnisave_service

@pytest.mark.asyncio
async def test_omnisave_agent_reach_sync():
    omnisave = get_omnisave_service()
    
    # Ingest dynamic real source
    ingest_res = await omnisave.ingest_source(
        platform="substack",
        url="https://substack.com/@engineeringatscale/p/agentic-ai",
        title="Agentic AI Systems in Production",
        author="Engineering at Scale",
        raw_content="Multi-agent orchestration requires strict RPC boundaries, event loops, and deterministic state transitions.",
        user_id="test-agent-reach-user"
    )
    assert ingest_res["success"] is True

    saved_sources = omnisave.get_user_saved_sources("test-agent-reach-user")
    assert len(saved_sources) >= 1

    # Test RAG querying over synced Agent Reach knowledge
    rag_res = await omnisave.query_knowledge_rag("multi-agent orchestration", user_id="test-agent-reach-user")
    assert "answer" in rag_res
    assert len(rag_res["citations"]) > 0
    assert rag_res["citations"][0]["title"] == "Agentic AI Systems in Production"

