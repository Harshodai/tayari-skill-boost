import pytest
from unittest import mock
from app.services.omnisave_service import OmnisaveService, _INSUFFICIENT_ANSWER_RESPONSE
from app.services.llm_service import active_engine, is_llm_configured

# ponytail: a valid UUID so DB-backed lookups (uuid_lib.UUID(user_id)) work in
# this module. The same identity is shared with test_autopilot_system.py.
TEST_USER_ID = "00000000-0000-0000-0000-0000000000aa"


@pytest.fixture
def require_live_llm():
    """Integration gate: fail when no real LLM provider is active.

    Guards RAG tests that would otherwise silently pass against a fabricated
    answer. Assert a real provider is configured — not mock-fallback/unconfigured.
    """
    assert is_llm_configured(), (
        "No real LLM provider configured (active_engine=%r) — RAG test requires "
        "a live provider, not mock-fallback/unconfigured." % active_engine()
    )
    assert active_engine() and active_engine() != "unconfigured"


@pytest.mark.asyncio
async def test_omnisave_agent_reach_sync():
    # ponytail: construct a fresh local instance to keep saved_sources/source_chunks
    # isolated from other tests, instead of sharing the module-level singleton.
    omnisave = OmnisaveService()

    # Ingest dynamic real source
    ingest_res = await omnisave.ingest_source(
        platform="substack",
        url="https://substack.com/@engineeringatscale/p/agentic-ai",
        title="Agentic AI Systems in Production",
        author="Engineering at Scale",
        raw_content="Multi-agent orchestration requires strict RPC boundaries, event loops, and deterministic state transitions.",
        user_id=TEST_USER_ID,
    )
    assert ingest_res["success"] is True

    saved_sources = omnisave.get_user_saved_sources(TEST_USER_ID)
    assert len(saved_sources) >= 1


@pytest.mark.network
@pytest.mark.asyncio
async def test_omnisave_agent_reach_rag(require_live_llm):
    # RAG behavior needs a real LLM provider — the fixture fails fast otherwise.
    omnisave = OmnisaveService()

    ingest_res = await omnisave.ingest_source(
        platform="substack",
        url="https://substack.com/@engineeringatscale/p/agentic-ai",
        title="Agentic AI Systems in Production",
        author="Engineering at Scale",
        raw_content="Multi-agent orchestration requires strict RPC boundaries, event loops, and deterministic state transitions.",
        user_id=TEST_USER_ID,
    )
    assert ingest_res["success"] is True

    # Test RAG querying over synced Agent Reach knowledge
    rag_res = await omnisave.query_knowledge_rag("multi-agent orchestration", user_id=TEST_USER_ID)
    assert "answer" in rag_res
    assert len(rag_res["citations"]) > 0
    assert rag_res["citations"][0]["title"] == "Agentic AI Systems in Production"


# --- Regression tests: chunk rehydration + DB-off in-memory RAG fallback ---

@pytest.mark.asyncio
async def test_ingest_rehydrates_chunks_with_user_id(tmp_path):
    """DB-hit rehydration loads chunks carrying the user_id, and the in-memory
    RAG fallback serves them when the DB pool is disabled."""
    omnisave = OmnisaveService()
    source = {
        "id": "src-1",
        "user_id": TEST_USER_ID,
        "idempotency_hash": "hash-1",
        "source_platform": "substack",
        "canonical_url": "https://substack.com/@x/p/y",
        "title": "Rehydrated Article",
        "author": "Author A",
        "raw_content": "Some indexed content for the chunk.",
        "clean_markdown": "# Rehydrated Article",
        "primary_category": "Career Strategy",
        "summary_bullets": [],
        "saved_at": "2026-08-03T00:00:00+00:00",
    }
    chunk_rows = [
        {
            "id": "chunk-1",
            "source_id": "src-1",
            "user_id": TEST_USER_ID,
            "chunk_index": 0,
            "chunk_content": "Chunk content about orchestration.",
            "title": "Rehydrated Article",
            "author": "Author A",
            "canonical_url": "https://substack.com/@x/p/y",
        }
    ]

    with mock.patch("app.services.omnisave_service.OmnisaveService._find_existing_source_db", new=mock.AsyncMock(return_value=source)), \
         mock.patch("app.services.omnisave_service.OmnisaveService._load_source_chunks_db", new=mock.AsyncMock(return_value=chunk_rows)), \
         mock.patch("app.services.omnisave_service.get_pool", new=mock.AsyncMock(return_value=None)):
        res = await omnisave.ingest_source(
            platform="substack",
            url="https://substack.com/@x/p/y",
            title="Rehydrated Article",
            author="Author A",
            raw_content="Some indexed content for the chunk.",
            user_id=TEST_USER_ID,
        )

    assert res["success"] is True
    assert res["chunks_created"] == 0
    assert any(s["id"] == "src-1" for s in omnisave.saved_sources)
    chunks = [c for c in omnisave.source_chunks if c.get("user_id") == TEST_USER_ID]
    assert len(chunks) == 1
    assert chunks[0]["id"] == "chunk-1"
    assert chunks[0]["user_id"] == TEST_USER_ID

    # ponytail: seed a foreign user's saved source AND chunk with
    # distinguishable metadata and content that contains the queried term
    # ("orchestration"), so the in-memory RAG fallback must prove per-user
    # isolation — the foreign chunk must never leak into the context or
    # citations. Without the matching saved source the foreign chunk would be
    # excluded for missing-source reasons; without the matching term it would
    # be excluded for relevance reasons. Both are present, so only the
    # user_id filter can keep it out.
    omnisave.saved_sources.append({
        "id": "foreign-src-1",
        "user_id": "other-user",
        "idempotency_hash": "hash-foreign",
        "source_platform": "linkedin",
        "canonical_url": "https://foreign.example.com/secret",
        "title": "Foreign Top Secret Article",
        "author": "Foreign Author",
        "raw_content": "FOREIGN SECRET orchestration about a rival company's hiring plan.",
        "clean_markdown": "# Foreign Top Secret Article",
        "primary_category": "Career Strategy",
        "summary_bullets": [],
        "saved_at": "2026-08-03T00:00:00+00:00",
    })
    omnisave.source_chunks.append({
        "id": "foreign-chunk-1",
        "source_id": "foreign-src-1",
        "user_id": "other-user",
        "chunk_index": 0,
        "chunk_content": "FOREIGN SECRET orchestration about a rival company's hiring plan.",
        "title": "Foreign Top Secret Article",
        "author": "Foreign Author",
        "canonical_url": "https://foreign.example.com/secret",
        "embedding": None,
    })

    # DB pool disabled: query_knowledge_rag must fall back to in-memory chunks.
    async def fake_llm(system_message, user_message, **kw):
        return "The answer is grounded in [Source 1]."

    with mock.patch("app.services.omnisave_service.get_pool", new=mock.AsyncMock(return_value=None)), \
         mock.patch("app.services.omnisave_service.llm_complete", new=fake_llm):
        rag = await omnisave.query_knowledge_rag("orchestration", user_id=TEST_USER_ID)
    assert rag["context_snippets"]
    assert len(rag["citations"]) == 1
    assert rag["citations"][0]["title"] == "Rehydrated Article"
    joined_context = "\n".join(rag["context_snippets"])
    assert "FOREIGN SECRET" not in joined_context
    assert "Foreign Top Secret Article" not in joined_context
    assert all(c.get("title") != "Foreign Top Secret Article" for c in rag["citations"])


@pytest.mark.asyncio
async def test_ingest_conflict_discards_provisional_and_rehydrates_canonical():
    """A lost ON CONFLICT race discards provisional state and returns the
    canonical source with rehydrated chunks carrying the user_id."""
    omnisave = OmnisaveService()
    canonical = {
        "id": "canonical-1",
        "user_id": TEST_USER_ID,
        "idempotency_hash": "hash-x",
        "source_platform": "substack",
        "canonical_url": "https://substack.com/@x/p/z",
        "title": "Canonical Article",
        "author": "Author B",
        "raw_content": "Canonical content.",
        "clean_markdown": "# Canonical Article",
        "primary_category": "Career Strategy",
        "summary_bullets": [],
        "saved_at": "2026-08-03T00:00:00+00:00",
    }
    canonical_chunks = [
        {
            "id": "cchunk-1",
            "source_id": "canonical-1",
            "user_id": TEST_USER_ID,
            "chunk_index": 0,
            "chunk_content": "Canonical chunk.",
            "title": "Canonical Article",
            "author": "Author B",
            "canonical_url": "https://substack.com/@x/p/z",
        }
    ]
    outcome = {"inserted": False, "source": canonical, "chunks_created": 0}

    with mock.patch("app.services.omnisave_service.OmnisaveService._find_existing_source_db", new=mock.AsyncMock(return_value=None)), \
         mock.patch("app.services.omnisave_service.OmnisaveService._persist_source_db", new=mock.AsyncMock(return_value=outcome)), \
         mock.patch("app.services.omnisave_service.OmnisaveService._load_source_chunks_db", new=mock.AsyncMock(return_value=canonical_chunks)), \
         mock.patch("app.services.omnisave_service.get_pool", new=mock.AsyncMock(return_value=None)):
        res = await omnisave.ingest_source(
            platform="substack",
            url="https://substack.com/@x/p/z",
            title="Provisional",
            author="Author B",
            raw_content="Canonical content.",
            user_id=TEST_USER_ID,
        )

    assert res["success"] is True
    assert res["source_id"] == "canonical-1"
    assert res["chunks_created"] == 0
    # provisional source (uuid) must be gone, canonical present exactly once
    assert [s["id"] for s in omnisave.saved_sources].count("canonical-1") == 1
    assert len([s for s in omnisave.saved_sources if s.get("id") != "canonical-1"]) == 0
    chunks = [c for c in omnisave.source_chunks if c.get("source_id") == "canonical-1"]
    assert len(chunks) == 1
    assert chunks[0]["user_id"] == TEST_USER_ID


# --- Regression tests: final-answer citation grounding ---

def test_answer_grounding_cases():
    omnisave = OmnisaveService()
    refs = [
        {"citation": "[Source 1]", "title": "A", "author": "x", "url": "#"},
        {"citation": "[Source 2]", "title": "B", "author": "y", "url": "#"},
    ]

    # exact insufficiency response, no citations -> valid
    assert omnisave._answer_is_grounded(_INSUFFICIENT_ANSWER_RESPONSE, refs) is True
    # substantive answer with a valid citation -> valid
    assert omnisave._answer_is_grounded("RPC boundaries matter [Source 1].", refs) is True
    # uncited substantive answer -> invalid
    assert omnisave._answer_is_grounded("RPC boundaries matter a lot.", refs) is False
    # mixed insufficiency marker + citation -> still valid because it cites a source
    assert omnisave._answer_is_grounded("The snippets are not enough; see [Source 2].", refs) is True
    # unknown tag -> invalid
    assert omnisave._answer_is_grounded("Fabricated fact [Source 9].", refs) is False
    # empty/non-string -> invalid
    assert omnisave._answer_is_grounded("", refs) is False
    assert omnisave._answer_is_grounded(None, refs) is False


@pytest.mark.asyncio
async def test_ingest_retains_auto_topics_and_summary():
    """auto_tag's topics + one-line summary flow into the returned source:
    secondary_tags gets the topics, summary_bullets gets the summary when the
    caller provided none; caller-provided topics/summary win over auto values."""
    fake_tag = mock.AsyncMock(return_value=("Finance", ["stocks", "retirement"], "short summary"))

    omnisave = OmnisaveService()
    with mock.patch("app.services.omnisave_service.auto_tag", new=fake_tag), \
         mock.patch("app.services.omnisave_service.get_pool", new=mock.AsyncMock(return_value=None)):
        res = await omnisave.ingest_source(
            platform="substack",
            url="https://substack.com/@x/p/finance",
            title="Finance 101",
            author="Author F",
            raw_content="Stocks and retirement planning content.",
            user_id=TEST_USER_ID,
        )
    assert res["success"] is True
    assert res["source"]["secondary_tags"] == ["stocks", "retirement"]
    assert res["source"]["summary_bullets"] == ["short summary"]

    omnisave2 = OmnisaveService()
    with mock.patch("app.services.omnisave_service.auto_tag", new=fake_tag), \
         mock.patch("app.services.omnisave_service.get_pool", new=mock.AsyncMock(return_value=None)):
        res2 = await omnisave2.ingest_source(
            platform="substack",
            url="https://substack.com/@x/p/finance2",
            title="Finance 102",
            author="Author F",
            raw_content="More retirement content.",
            user_id=TEST_USER_ID,
            summary_bullets=["caller wins"],
            topics=["caller topics"],
        )
    assert res2["source"]["secondary_tags"] == ["caller topics"]
    assert res2["source"]["summary_bullets"] == ["caller wins"]


@pytest.mark.asyncio
async def test_query_knowledge_rag_replaces_uncited_answer():
    """An uncited LLM answer is replaced with the fixed insufficiency response."""
    omnisave = OmnisaveService()
    omnisave.saved_sources = [
        {"id": "s1", "user_id": TEST_USER_ID, "idempotency_hash": "h",
         "source_platform": "substack", "canonical_url": "u", "title": "T",
         "author": "A", "raw_content": "c", "clean_markdown": "m",
         "primary_category": "Career Strategy", "summary_bullets": [], "saved_at": None}
    ]
    omnisave.source_chunks = [
        {"id": "ch1", "source_id": "s1", "user_id": TEST_USER_ID, "chunk_index": 0,
         "chunk_content": "Content here.", "embedding": None}
    ]

    async def fake_llm(system_message, user_message, **kw):
        return "Answer with no citation tag."

    with mock.patch("app.services.omnisave_service.OmnisaveService._load_user_chunks_db", new=mock.AsyncMock(return_value=[])), \
         mock.patch("app.services.omnisave_service.llm_complete", new=fake_llm):
        rag = await omnisave.query_knowledge_rag("query", user_id=TEST_USER_ID)
    assert rag["answer"] == _INSUFFICIENT_ANSWER_RESPONSE
