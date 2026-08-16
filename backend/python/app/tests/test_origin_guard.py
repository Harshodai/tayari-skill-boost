"""Tests for the browser agent origin guard (Flow 6 tier 2 / §1.5).

Covers the required scenarios:
  (a) same-origin credential entry is allowed;
  (b) cross-origin credential entry raises OriginGuardError;
  (c) a non-credential field on a cross-origin page does NOT raise
      (the guard fires only for credential fields);
  (d) BROWSER_ALLOWED_ORIGINS extends the allowlist beyond the start origin.
Plus the agent-level composition rules:
  (e) an unresolved target label fails closed on a cross-origin page;
  (f) a password-type input is treated as a credential target.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.browser_automation.agent import _guard_credential_entry
from app.services.browser_automation.origin_guard import (
    OriginGuardError,
    assert_origin_for_credential_entry,
    credential_field_heuristic,
    extract_origin,
    is_allowed_origin,
)


START = "https://jobs.workday.com"
ATTACK = "https://evil-phish.example.com"


def _fake_action(action_dump: dict):
    """Minimal stand-in for browser-use's ActionModel with model_dump."""
    return SimpleNamespace(model_dump=lambda exclude_none: action_dump)


def _guard_state(url: str, selector_map: dict):
    """Minimal stand-in for the browser-use BrowserState the guard reads."""
    return SimpleNamespace(url=url, selector_map=selector_map)


def _guard_fake_output(*actions) -> SimpleNamespace:
    return SimpleNamespace(action=list(actions))


def test_extract_origin_strips_path_and_default_port():
    assert extract_origin("https://jobs.workday.com/apply/123") == "https://jobs.workday.com"
    assert extract_origin("http://localhost:8080/path") == "http://localhost:8080"
    assert extract_origin("https://jobs.workday.com:443/x") == "https://jobs.workday.com"
    assert extract_origin("not a url") == ""
    assert extract_origin("") == ""


def test_is_allowed_origin_matches_exact_origin():
    assert is_allowed_origin("https://jobs.workday.com/x", ["https://jobs.workday.com"]) is True
    assert is_allowed_origin("https://jobs.workday.com:443/x", ["https://jobs.workday.com"]) is True
    assert is_allowed_origin("https://evil.example.com/x", ["https://jobs.workday.com"]) is False
    assert is_allowed_origin("", ["https://jobs.workday.com"]) is False


def test_credential_field_heuristic_matches_credential_labels():
    assert credential_field_heuristic("Password") is True
    assert credential_field_heuristic("Enter your password") is True
    assert credential_field_heuristic("Sign in") is True
    assert credential_field_heuristic("Sign-in") is True
    assert credential_field_heuristic("2FA code") is True
    assert credential_field_heuristic("MFA token") is True
    assert credential_field_heuristic("OTP verification code") is True
    assert credential_field_heuristic("Email and password") is True


def test_credential_field_heuristic_ignores_ordinary_ats_fields():
    """The guard must NOT trip on normal ATS fields, or it blocks legit fills."""
    assert credential_field_heuristic("Email") is False
    assert credential_field_heuristic("Full name") is False
    assert credential_field_heuristic("Phone number") is False
    assert credential_field_heuristic("Work authorization") is False
    assert credential_field_heuristic("Years of experience") is False
    assert credential_field_heuristic("") is False


def test_a_same_origin_credential_entry_is_allowed():
    """Scenario (a): credential fill on the start origin does not raise."""
    assert_origin_for_credential_entry(
        current_url=f"{START}/login",
        start_url=f"{START}/apply/123",
        allowed_origins=[],
    )


def test_b_cross_origin_credential_entry_raises():
    """Scenario (b): credential fill on an attacker origin raises."""
    with pytest.raises(OriginGuardError) as exc:
        assert_origin_for_credential_entry(
            current_url=f"{ATTACK}/login",
            start_url=f"{START}/apply/123",
            allowed_origins=[],
        )
    assert "blocked" in str(exc.value)


def test_c_non_credential_field_on_cross_origin_page_does_not_raise():
    """Scenario (c): the guard only fires for credential fields.

    A plain ATS textbox on a cross-origin page is not a credential fill, so
    the agent-level guard must not raise: the label resolves, the heuristic
    does not match, and the assertion is skipped.
    """
    state = _guard_state(
        url=f"{ATTACK}/apply",
        selector_map={1: SimpleNamespace(attributes={"name": "full_name"}, tag_name="input")},
    )
    output = _guard_fake_output(_fake_action({"input_text": {"index": 1, "text": "John"}}))
    _guard_credential_entry(state, output, start_url=f"{START}/apply/123", allowed_origins=[])


def test_c2_unresolved_label_fails_closed_on_cross_origin():
    """Scenario (e): an unresolved target label must NOT skip the guard.

    When the action's index is missing from the selector_map, the label is
    "" — the guard treats that as credential-sensitive (fail-closed) and
    asserts the origin, raising on the attacker's page.
    """
    state = _guard_state(url=f"{ATTACK}/apply", selector_map={})
    output = _guard_fake_output(_fake_action({"input_text": {"index": 1, "text": "secret"}}))
    with pytest.raises(OriginGuardError):
        _guard_credential_entry(state, output, start_url=f"{START}/apply/123", allowed_origins=[])


def test_c3_password_type_input_is_a_credential_target():
    """Scenario (f): <input type=password> must trip the guard.

    Even with no label attributes, the type attribute alone identifies a
    credential field — the label resolves to "<input type=password>" and the
    heuristic matches, so a fill on the attacker's origin raises.
    """
    state = _guard_state(
        url=f"{ATTACK}/apply",
        selector_map={1: SimpleNamespace(attributes={"type": "password"}, tag_name="input")},
    )
    output = _guard_fake_output(_fake_action({"input_text": {"index": 1, "text": "hunter2"}}))
    with pytest.raises(OriginGuardError):
        _guard_credential_entry(state, output, start_url=f"{START}/apply/123", allowed_origins=[])


def test_c4_unlabeled_input_fails_closed_on_cross_origin():
    """An input with no usable attributes must NOT resolve to a tag-only
    label (which the heuristic would read as non-credential). The empty label
    is credential-sensitive, so a fill on the attacker's origin raises."""
    state = _guard_state(
        url=f"{ATTACK}/apply",
        selector_map={1: SimpleNamespace(attributes={}, tag_name="input")},
    )
    output = _guard_fake_output(_fake_action({"input_text": {"index": 1, "text": "secret"}}))
    with pytest.raises(OriginGuardError):
        _guard_credential_entry(state, output, start_url=f"{START}/apply/123", allowed_origins=[])


def test_c4b_unlabeled_input_allowed_on_start_origin():
    """The same fail-closed label on the TRUSTED start origin is allowed."""
    state = _guard_state(
        url=f"{START}/apply",
        selector_map={1: SimpleNamespace(attributes={}, tag_name="input")},
    )
    output = _guard_fake_output(_fake_action({"input_text": {"index": 1, "text": "secret"}}))
    _guard_credential_entry(state, output, start_url=f"{START}/apply/123", allowed_origins=[])


def test_c5_click_action_is_not_guarded():
    """Only input_text actions are credential entry points — a click on a
    credential-looking element on the attacker's origin must NOT raise."""
    state = _guard_state(
        url=f"{ATTACK}/apply",
        selector_map={1: SimpleNamespace(attributes={"type": "password"}, tag_name="input")},
    )
    output = _guard_fake_output(_fake_action({"click_element": {"index": 1}}))
    _guard_credential_entry(state, output, start_url=f"{START}/apply/123", allowed_origins=[])


def test_c6_model_dump_failure_fails_closed():
    """If an action dump cannot be produced, the guard asserts the origin
    instead of silently skipping the action (fail-closed)."""

    def _boom(exclude_none):
        raise RuntimeError("dump failed")

    state = _guard_state(url=f"{ATTACK}/apply", selector_map={})
    output = _guard_fake_output(SimpleNamespace(model_dump=_boom))
    with pytest.raises(OriginGuardError):
        _guard_credential_entry(state, output, start_url=f"{START}/apply/123", allowed_origins=[])


def test_d_allowed_origins_env_extends_the_list():
    """Scenario (d): BROWSER_ALLOWED_ORIGINS extends the allowlist."""
    # Without the extra origin, the attack origin is blocked.
    with pytest.raises(OriginGuardError):
        assert_origin_for_credential_entry(
            current_url="https://partner-ats.example.com/login",
            start_url=f"{START}/apply/123",
            allowed_origins=[],
        )
    # With the extra origin, it is allowed.
    assert_origin_for_credential_entry(
        current_url="https://partner-ats.example.com/login",
        start_url=f"{START}/apply/123",
        allowed_origins=["https://partner-ats.example.com"],
    )


def test_no_start_url_blocks_all_credential_entry_fail_closed():
    """When no start URL can be parsed, the guard fails closed."""
    with pytest.raises(OriginGuardError):
        assert_origin_for_credential_entry(
            current_url=f"{ATTACK}/login",
            start_url="",
            allowed_origins=[],
        )


def test_credential_field_heuristic_expanded_security_and_captcha_fields():
    """Test all required security, credential, and captcha field patterns."""
    # Password variants
    assert credential_field_heuristic("Password") is True
    assert credential_field_heuristic("Enter Password") is True
    assert credential_field_heuristic("Passcode") is True
    assert credential_field_heuristic("passwd") is True

    # OTP / MFA / 2FA
    assert credential_field_heuristic("OTP") is True
    assert credential_field_heuristic("OTP code") is True
    assert credential_field_heuristic("MFA") is True
    assert credential_field_heuristic("MFA token") is True
    assert credential_field_heuristic("2FA code") is True
    assert credential_field_heuristic("Verification code") is True
    assert credential_field_heuristic("Auth code") is True
    assert credential_field_heuristic("Authentication code") is True
    assert credential_field_heuristic("Authenticator") is True

    # PIN
    assert credential_field_heuristic("PIN") is True
    assert credential_field_heuristic("PIN code") is True
    assert credential_field_heuristic("Enter your PIN") is True

    # SSN / National ID
    assert credential_field_heuristic("SSN") is True
    assert credential_field_heuristic("Social Security") is True
    assert credential_field_heuristic("Social Security Number") is True
    assert credential_field_heuristic("National ID") is True
    assert credential_field_heuristic("Tax ID") is True

    # Secret / Security Questions
    assert credential_field_heuristic("Secret question") is True
    assert credential_field_heuristic("Security question") is True
    assert credential_field_heuristic("Mother's maiden name") is True
    assert credential_field_heuristic("Mothers maiden name") is True

    # CAPTCHA variants
    assert credential_field_heuristic("CAPTCHA") is True
    assert credential_field_heuristic("reCAPTCHA") is True
    assert credential_field_heuristic("hCaptcha") is True
    assert credential_field_heuristic("Turnstile") is True
    assert credential_field_heuristic("Cloudflare challenge") is True
    assert credential_field_heuristic("Bot verification") is True


def test_credential_entry_blocked_error_subclasses_origin_guard_error():
    from app.services.browser_automation.origin_guard import CredentialEntryBlockedError
    assert issubclass(CredentialEntryBlockedError, OriginGuardError)


def test_approved_ats_domain_validation():
    from app.services.browser_automation.origin_guard import (
        APPROVED_ATS_DOMAINS,
        assert_strict_ats_origin,
        is_approved_ats_domain,
    )

    # All approved ATS providers
    assert is_approved_ats_domain("https://boards.greenhouse.io/company/jobs/1") is True
    assert is_approved_ats_domain("https://jobs.lever.co/company/2") is True
    assert is_approved_ats_domain("https://company.myworkdayjobs.com/apply") is True
    assert is_approved_ats_domain("https://workday.com/login") is True
    assert is_approved_ats_domain("https://jobs.ashbyhq.com/company") is True
    assert is_approved_ats_domain("https://jobs.smartrecruiters.com/company") is True
    assert is_approved_ats_domain("https://company.icims.com") is True
    assert is_approved_ats_domain("https://company.taleo.net") is True
    assert is_approved_ats_domain("https://company.successfactors.com") is True
    assert is_approved_ats_domain("https://company.bamboohr.com") is True
    assert is_approved_ats_domain("https://jobs.jobvite.com") is True
    assert is_approved_ats_domain("https://company.workable.com") is True
    assert is_approved_ats_domain("https://company.recruitee.com") is True
    assert is_approved_ats_domain("https://company.rippling.com") is True

    # Hostname strings directly
    assert is_approved_ats_domain("greenhouse.io") is True
    assert is_approved_ats_domain("lever.co") is True

    # Malicious lookalikes
    assert is_approved_ats_domain("https://evil-greenhouse.io") is False
    assert is_approved_ats_domain("https://workday.com.evil.com") is False
    assert is_approved_ats_domain("https://phish.example.com") is False

    # Strict ATS origin assertion
    assert_strict_ats_origin("https://boards.greenhouse.io/acme")
    with pytest.raises(OriginGuardError):
        assert_strict_ats_origin("https://evil.example.com/login")


@pytest.mark.asyncio
async def test_route_to_human_handoff_enqueues_question():
    from unittest.mock import AsyncMock, patch
    from app.services.browser_automation.origin_guard import route_to_human_handoff

    with patch("app.services.question_queue.enqueue_questions", new=AsyncMock(return_value=1)) as mock_enqueue:
        res = await route_to_human_handoff(
            "Enter OTP code",
            user_id="user_123",
            run_id="run_456",
            job_title="Software Engineer",
            company="Acme Corp",
        )
        assert res["status"] == "human_handoff_enqueued"
        assert res["enqueued"] is True
        assert mock_enqueue.call_count == 1
        call_args = mock_enqueue.call_args[0][0]
        assert call_args[0]["field_label"] == "Enter OTP code"
        assert call_args[0]["sensitivity_class"] == "credential"