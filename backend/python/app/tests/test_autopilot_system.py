import pytest
from app.services.form_filler import FormFiller as TayariComputerSandboxExecutor
from app.services.omnisave_service import OmnisaveService
from app.services.email_classifier import match_email_to_application
import httpx
from app.services.llm_service import is_llm_configured, LLMNotConfiguredError


def test_tayari_computer_sandbox_redaction():
    executor = TayariComputerSandboxExecutor()
    profile = {
        "name": "Jane Candidate",
        "ssn": "123-45-6789",
        "email": "jane@example.com"
    }
    redacted = executor.redact_sensitive_data(profile)
    assert redacted["ssn"] == "[REDACTED_SSN]"
    assert redacted["name"] == "Jane Candidate"

@pytest.mark.asyncio
async def test_omnisave_rag_engine():
    omnisave = OmnisaveService()
    # ponytail: same valid-UUID test identity as test_omnisave_agent_reach.py so
    # the shared test subject is consistent across both modules.
    test_user_id = "00000000-0000-0000-0000-0000000000aa"
    ingest_res = await omnisave.ingest_source(
        platform="substack",
        url="https://substack.com/@test",
        title="Zero-Downtime Architecture",
        author="Tech Lead",
        raw_content="Dual-write database strategy ensures zero data loss during microservices refactoring.",
        user_id=test_user_id
    )
    assert ingest_res["success"] is True
    source_id = ingest_res["source_id"]

    # ponytail: RAG answers come from the configured LLM provider and raise
    # LLMNotConfiguredError when none is set — no fabricated fallback text.
    # Skip the LLM portion when no real provider is configured; the ingest
    # assertions above still run.
    if not is_llm_configured():
        pytest.skip("No real LLM provider configured; skipping RAG answer assertions")

    try:
        rag_res = await omnisave.query_knowledge_rag("system architecture", user_id=test_user_id)
    except (LLMNotConfiguredError, httpx.HTTPError) as e:
        pytest.skip(f"LLM call failed ({e}); skipping live RAG answer assertion")

    assert "answer" in rag_res
    assert len(rag_res["citations"]) >= 1
    assert any(c["title"] == "Zero-Downtime Architecture" for c in rag_res["citations"]), "Citations must include the ingested source"

def test_email_classifier_warning_alert():
    apps = [{"id": "APP-1", "company": "Stripe", "title": "Staff Engineer", "stage": "APPLIED"}]
    res = match_email_to_application("Stripe Update", "Thank you for applying to Stripe for Staff Engineer position.", apps)
    # Strong match: stage "applied" confidence 0.80 + company/role perfect match = combined 0.90 >= 0.8
    assert res["warning_alert"] is False
    assert res["action"] == "needs_review"
    assert res["confidence"] == 0.90
