from __future__ import annotations

import pytest
from app.services.omnisave_service import OmnisaveService, _INSUFFICIENT_ANSWER_RESPONSE
from app.services.grounding import claims_supported, verified_contact


def test_grounding_verified_contact_rejects_untraceable():
    resume = "John Doe, email: john@example.com, phone: 415-555-0199"
    assert verified_contact("john@example.com", resume) == "john@example.com"
    assert verified_contact("415-555-0199", resume) == "415-555-0199"
    assert verified_contact("hacker@malicious.com", resume) == ""
    assert verified_contact("999-999-9999", resume) == ""


def test_claims_supported_rejects_hallucinations():
    resume = "Software Engineer at Stripe with AWS experience."
    jd = "Seeking backend engineer with Go and AWS skills."

    # Grounded claim
    valid_text = "Experienced with AWS at Stripe."
    assert claims_supported(valid_text, resume, jd) is True

    # Hallucinated employer
    fake_employer = "Experienced engineer at Google and Meta."
    assert claims_supported(fake_employer, resume, jd) is False

    # Hallucinated credential
    fake_cred = "Certified CISSP with AWS knowledge."
    assert claims_supported(fake_cred, resume, jd) is False


from unittest import mock


@pytest.mark.asyncio
async def test_omnisave_query_refuses_when_no_durable_sources():
    service = OmnisaveService()
    test_user_id = "00000000-0000-0000-0000-000000000001"
    
    # 1. When durable storage returns empty (no indexed sources), refuse with explicit message
    with mock.patch.object(service, "list_user_saved_sources", new=mock.AsyncMock(return_value=[])):
        res = await service.query_knowledge_rag("What were the revenue numbers?", user_id=test_user_id)
        assert res["has_evidence"] is False
        assert len(res["citations"]) == 0
        assert "no indexed articles" in res["answer"].lower()

    # 2. When durable storage pool is unreachable, fail closed with RuntimeError
    with mock.patch("app.services.omnisave_service.get_pool", new=mock.AsyncMock(return_value=None)):
        with pytest.raises(RuntimeError, match="knowledge_store_unavailable"):
            await service.query_knowledge_rag("What were the revenue numbers?", user_id=test_user_id)
