"""Tests for Subagent 8: Privacy-safe Gmail Ingestion & Scope Boundaries."""
from __future__ import annotations

import os
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-gmail-tests")

import pytest
from unittest.mock import patch, AsyncMock
from app.services.llm_service import parse_application_email, LLMNotConfiguredError
from app.api.gmail_routes import ParseEmailRequest, parse_email, disconnect_gmail
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_recruiter_email_classification():
    # Job application / interview invitation email
    recruiter_text = """
    Subject: Interview Invitation: Senior Go Engineer at Stripe
    From: recruiter@stripe.com
    
    Hi Alex,
    Thanks for applying to Stripe! We would love to invite you for a 45-minute technical
    interview next Tuesday to discuss your distributed systems background.
    """
    mock_parsed = {
        "is_job_related": True,
        "company": "Stripe",
        "title": "Senior Go Engineer",
        "stage": "interview",
        "interview_date": "2026-03-15T14:00:00Z",
        "contact": "recruiter@stripe.com",
        "summary": "Invitation for a 45-minute technical interview at Stripe."
    }
    with patch("app.services.llm_service.llm_json", new_callable=AsyncMock, return_value=mock_parsed):
        res = await parse_application_email(recruiter_text)
    assert res.get("is_job_related") is True
    assert "stripe" in (res.get("company") or "").lower()
    assert res.get("stage") == "interview"


@pytest.mark.asyncio
async def test_non_recruiting_email_rejected():
    # Personal / newsletter / banking email
    personal_text = """
    Subject: Your monthly banking statement is available
    From: statements@bankofamerica.com
    
    Dear Customer,
    Your monthly statement for account ending in 1234 is ready for download.
    Please log in to your account to view your balance.
    """
    mock_parsed = {
        "is_job_related": False,
        "company": "",
        "title": "",
        "stage": "saved",
        "interview_date": None,
        "contact": None,
        "summary": "Monthly banking statement notification."
    }
    with patch("app.services.llm_service.llm_json", new_callable=AsyncMock, return_value=mock_parsed):
        res = await parse_application_email(personal_text)
    assert res.get("is_job_related") is False


@pytest.mark.asyncio
async def test_parse_email_rejects_when_capability_disabled():
    with patch.dict(os.environ, {"CAPABILITY_AUTONOMOUS_GMAIL": "false"}):
        with pytest.raises(HTTPException) as exc_info:
            await parse_email(ParseEmailRequest(email_text="Valid email text content"))
        assert exc_info.value.status_code == 423
        assert exc_info.value.detail["code"] == "disabled_by_launch_scope"


@pytest.mark.asyncio
async def test_parse_email_rejects_empty_payload():
    with patch.dict(os.environ, {"CAPABILITY_AUTONOMOUS_GMAIL": "true"}):
        with pytest.raises(HTTPException) as exc_info:
            await parse_email(ParseEmailRequest(email_text="short"))
        assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_disconnect_purges_metadata():
    user_id = "00000000-0000-0000-0000-000000000042"
    res = await disconnect_gmail(user_id=user_id)
    assert res["ok"] is True
    assert res["purged"] is True
    assert res["user_id"] == user_id

