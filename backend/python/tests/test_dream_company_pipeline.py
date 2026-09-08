from __future__ import annotations

import pytest
from app.services.job_agent import expand_queries
from app.services.job_identity import job_identity, freshness_status
from app.services.optimizer import _build_instruction_ledger, _compute_bullet_diffs
from app.guardrails import PipelineGate
from app.services.computer_control import (
    ComputerActionClass,
    ComputerActionRequest,
    ComputerMode,
    ComputerRun,
    ComputerRunPolicy,
    origin_allowed,
)
from app.services.submission_receipt import build_receipt
from uuid import uuid4
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_dream_company_e2e_pipeline_verification():
    # Stage 1: Strategy loads from target company & role
    target_company = "Google"
    target_role = "Senior Software Engineer"
    queries = expand_queries(f"{target_company} {target_role}", {"target_company": target_company, "target_role": target_role})
    assert len(queries) >= 1
    assert any("engineer" in q.lower() for q in queries)

    # Stage 2: Existing job discovered with canonical identity
    job_payload = {
        "title": "Senior Software Engineer, Cloud Infrastructure",
        "company": "Google",
        "location": "Sunnyvale, CA",
        "url": "https://careers.google.com/jobs/results/123456789/?utm_source=linkedin",
        "provider": "google_careers",
        "observed_at": datetime.now(timezone.utc).isoformat(),
    }
    identity = job_identity(job_payload)
    assert identity["key"] is not None
    assert identity["source_url"] == "https://careers.google.com/jobs/results/123456789"
    assert freshness_status(identity["observed_at"]) == "fresh"

    # Stage 3: New-job detection later with duplicate check
    duplicate_payload = dict(job_payload, url="https://careers.google.com/jobs/results/123456789/?utm_campaign=tracker")
    duplicate_identity = job_identity(duplicate_payload)
    assert duplicate_identity["key"] == identity["key"], "Deduplication key must match despite tracking query differences"

    # Stage 4: Resume optimization with custom instructions ledger
    resume_text = "Software Engineer at TechCorp serving 10M DAU. Built distributed backend systems using Go and Python."
    custom_instructions = "Emphasize high scale distributed systems\nAdd metrics"
    opt_text = "Senior Software Engineer at TechCorp. Architected high-throughput distributed systems in Go and Python scaling to 10M DAU."

    ledger = _build_instruction_ledger(custom_instructions, opt_text, resume_text)
    assert len(ledger) == 2
    assert ledger[0]["status"] == "applied"

    # Stage 5: Guardrails gate
    gate = PipelineGate()
    g_result = gate.check(optimized_text=opt_text, original_text=resume_text)
    assert g_result["all_passed"] is True

    # Stage 6: Browser task policy - strictly review-first
    policy = ComputerRunPolicy(
        allowed_origins=("https://careers.google.com",),
        submission_enabled=False,
    )
    assert origin_allowed("https://careers.google.com", policy) is True
    assert origin_allowed("https://malicious-phishing.test", policy) is False

    # Stage 7: Autonomous submission blocked; requires candidate confirmation / takeover
    with pytest.raises(ValueError, match="computer submission is disabled by the first-release contract"):
        ComputerRunPolicy(submission_enabled=True)

    # Stage 8: Verified Receipt creation
    receipt = build_receipt(
        run_id=str(uuid4()),
        user_id=str(uuid4()),
        job=job_payload,
        resume_text=opt_text,
        agent_summary="Application was successfully submitted. Confirmation number: GOOG-CONF-7890",
        final_url="https://careers.google.com/thankyou",
    )
    assert receipt["verified"] is True
    assert receipt["outcome"] == "submitted"
    assert receipt["confirmation_number"] == "GOOG-CONF-7890"
    assert receipt["submitted_resume_sha256"] is not None
