import logging
from typing import Any, Dict
from unittest import mock

import pytest

from app.services.job_application_automation import apply_job


def test_apply_job_success(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    """Test successful job application.

    Mocks the Browser.apply_job method to return True and verifies that
    ``apply_job`` returns ``"applied"`` and logs a success message.
    """
    mock_browser: Any = mock.Mock()
    mock_browser.apply_job.return_value = True
    monkeypatch.setattr(
        "app.services.job_application_automation.Browser",
        mock_browser,
    )
    job: Dict[str, str] = {
        "title": "Software Engineer",
        "company": "Acme Corp",
        "url": "https://jobs.example.com/123",
    }
    resume = "Resume text"
    cover = "Cover letter text"
    with caplog.at_level(logging.INFO):
        result = apply_job(job, resume, cover)
    assert result == "applied"
    assert any("Job applied successfully" in rec.message for rec in caplog.records)


def test_apply_job_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test failure path when Browser.apply_job raises an exception."""
    mock_browser = mock.Mock()
    mock_browser.apply_job.side_effect = RuntimeError("browser error")
    monkeypatch.setattr(
        "app.services.job_application_automation.Browser",
        mock_browser,
    )
    job = {"title": "DevOps Engineer", "company": "Beta Ltd", "url": "https://jobs.example.com/456"}
    resume = "Resume text"
    cover = "Cover letter text"
    with pytest.raises(RuntimeError):
        apply_job(job, resume, cover)
