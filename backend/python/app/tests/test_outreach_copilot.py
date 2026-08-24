import pytest
from unittest.mock import patch, AsyncMock

from app.services.outreach_copilot import generate_recruiter_outreach, RecruiterOutreachDraft
from app.services.llm_service import LLMNotConfiguredError


@pytest.mark.asyncio
async def test_outreach_no_fabrication_when_llm_unconfigured():
    # ponytail: regression test for a real fabrication bug — this used to call
    # the LLM, discard its real response into an unused "ai_raw" field, and
    # always serve identical hardcoded templates as cold_email/linkedin_note/
    # followup_bump regardless of whether the LLM ran at all. A candidate
    # clicking "Open in Gmail" sent the exact same generic email every time.
    with patch("app.services.outreach_copilot.llm_json", new_callable=AsyncMock, side_effect=LLMNotConfiguredError("unconfigured")):
        res = await generate_recruiter_outreach(
            recruiter_name="Jane Doe", company="Acme", target_role="Senior Engineer",
            candidate_proof_points="Led a 45% latency reduction on the payments platform.",
        )
    assert res["llm_available"] is False
    assert res["cold_email"] is None
    assert res["linkedin_note"] is None
    assert res["followup_bump"] is None
    # predicted_emails is honestly labeled as a prediction, not gated on LLM availability
    assert len(res["predicted_emails"]) == 5


@pytest.mark.asyncio
async def test_outreach_uses_real_llm_draft_when_available():
    draft = RecruiterOutreachDraft(
        cold_email_subject="Re: Senior Engineer at Acme",
        cold_email_body="Hi Jane, I led a 45% latency reduction on our payments platform...",
        linkedin_note="Hi Jane, following Acme's Senior Engineer opening — happy to share context.",
        followup_bump="Hi Jane, checking back briefly on my note below.",
    )
    with patch("app.services.outreach_copilot.llm_json", new_callable=AsyncMock, return_value=draft):
        res = await generate_recruiter_outreach(
            recruiter_name="Jane Doe", company="Acme", target_role="Senior Engineer",
            candidate_proof_points="Led a 45% latency reduction on the payments platform.",
        )
    assert res["llm_available"] is True
    assert res["cold_email"]["subject"] == draft.cold_email_subject
    assert res["cold_email"]["body"] == draft.cold_email_body
    assert res["linkedin_note"] == draft.linkedin_note
    assert res["followup_bump"] == draft.followup_bump
