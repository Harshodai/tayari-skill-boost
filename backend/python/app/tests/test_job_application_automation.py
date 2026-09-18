import logging
from typing import Dict

import pytest

from app.services.job_application_automation import apply_job


def test_apply_job_creates_manual_handoff_without_browser(caplog: pytest.LogCaptureFixture) -> None:
    job: Dict[str, str] = {
        "title": "Software Engineer",
        "company": "Acme Corp",
        "url": "https://jobs.example.com/123",
    }
    resume = "Resume text"
    cover = "Cover letter text"
    with caplog.at_level(logging.INFO):
        result = apply_job(job, resume, cover)
    assert result == "awaiting_manual_submission"
    assert any("Manual submission required" in rec.message for rec in caplog.records)


def test_apply_job_rejects_invalid_job_data() -> None:
    job = {"title": "DevOps Engineer", "company": "Beta Ltd", "url": "not-a-url"}
    resume = "Resume text"
    cover = "Cover letter text"
    with pytest.raises(ValueError):
        apply_job(job, resume, cover)
