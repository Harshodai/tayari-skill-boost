"""Comprehensive pytest suite for Tayari Computer & Browser Operator Runtime.

Tests:
1. Accessibility tree parsing and node ref generation (roles, labels, disambiguation, stale refs).
2. SSRF validation (localhost, private CIDRs, link-local metadata, IPv6, DNS multi-homing).
3. BrowserOperator navigation, header lifecycle, and redirect validation.
4. WS-06 Kill switch, two-user authz isolation, and cancellation propagation.
5. Glass-Box SSE stream event lifecycle and serialization.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest import mock
import pytest

from app.agent.agent_engine import _is_safe_url, _resolve_and_validate_url
from app.agent.browser_operator import BrowserOperator
from app.services.browser_automation.agent import (
    AgentResult,
    RunCancelled,
    run_browser_agent,
    stream_browser_agent,
)
from app.services.browser_automation.session import (
    BrowserAuthzError,
    BrowserSession,
    LocalPlaywrightProvider,
    cancel_run,
    is_cancelled,
    open_session,
    _SESSIONS,
)


# ============================================================================
# 1. ACCESSIBILITY NODE REF MAPPING TESTS
# ============================================================================

class TestAccessibilityRefMapping:
    """Verify semantic element addressability and ref lifecycle."""

    def test_parse_interactive_roles_and_names(self):
        tree = (
            '- textbox "First Name"\n'
            '- textbox "Last Name"\n'
            '- combobox "Country of Residence"\n'
            '- checkbox "I agree to Terms"\n'
            '- button "Submit Application"\n'
            '- link "Privacy Policy"\n'
        )
        elements = BrowserOperator._parse_accessibility_tree(tree)
        assert len(elements) == 6
        assert elements[0] == {"role": "textbox", "name": "First Name", "index": 0}
        assert elements[2] == {"role": "combobox", "name": "Country of Residence", "index": 0}
        assert elements[4] == {"role": "button", "name": "Submit Application", "index": 0}

    def test_parse_disambiguates_duplicate_labels(self):
        tree = (
            '- textbox "Phone Number"\n'
            '- textbox "Phone Number"\n'
            '- textbox "Phone Number"\n'
        )
        elements = BrowserOperator._parse_accessibility_tree(tree)
        assert len(elements) == 3
        assert [e["index"] for e in elements] == [0, 1, 2]

    def test_parse_escaped_quotes_and_unnamed_inputs(self):
        tree = (
            '- textbox "Enter \\"Full Name\\""\n'
            '- textbox\n'
            '- paragraph: "Please fill the form below"\n'
            '- heading "Job Application"\n'
        )
        elements = BrowserOperator._parse_accessibility_tree(tree)
        assert len(elements) == 2
        assert elements[0] == {"role": "textbox", "name": 'Enter "Full Name"', "index": 0}
        assert elements[1] == {"role": "textbox", "name": "", "index": 0}

    @pytest.mark.asyncio
    async def test_observe_maps_live_locators_and_detects_stale_refs(self):
        op = BrowserOperator()
        op.page = mock.MagicMock()
        mock_body = mock.MagicMock()
        mock_body.aria_snapshot = mock.AsyncMock(return_value=(
            '- textbox "Email"\n'
            '- button "Submit"\n'
        ))
        op.page.locator.return_value = mock_body
        
        mock_loc_email = mock.AsyncMock()
        mock_loc_submit = mock.AsyncMock()
        
        def mock_get_by_role(role, name=None, exact=True):
            loc = mock.MagicMock()
            loc.nth.return_value = mock_loc_email if role == "textbox" else mock_loc_submit
            return loc
            
        op.page.get_by_role = mock_get_by_role
        op.page.url = "https://jobs.example.com/apply"

        # 1. Observe creates live refs
        obs = await op.observe()
        assert obs["success"] is True
        assert len(obs["elements"]) == 2
        assert obs["elements"][0] == {"ref": "ref_1", "role": "textbox", "name": "Email"}
        assert obs["elements"][1] == {"ref": "ref_2", "role": "button", "name": "Submit"}
        assert "ref_1" in op._refs
        assert "ref_2" in op._refs

        # 2. Fill via ref_1 succeeds and preserves refs for batched entry
        fill_res = await op.fill("ref_1", "candidate@example.com")
        assert fill_res["success"] is True
        mock_loc_email.fill.assert_awaited_once_with("candidate@example.com", timeout=5000)
        assert "ref_1" in op._refs  # Refs stay intact during filling

        # 3. Click via ref_2 invalidates refs
        click_res = await op.click("ref_2")
        assert click_res["success"] is True
        mock_loc_submit.click.assert_awaited_once_with(timeout=5000)
        assert op._refs == {}  # Wiped on mutation/navigation

        # 4. Reusing stale ref_1 immediately fails closed
        stale_res = await op.click("ref_1")
        assert stale_res["success"] is False
        assert "stale or unknown ref 'ref_1'" in stale_res["error"]


# ============================================================================
# 2. SSRF PROTECTION ON FORM NAVIGATION TESTS
# ============================================================================

class TestSSRFProtection:
    """Verify complete rejection of internal, private, link-local, and cloud metadata targets."""

    @pytest.mark.parametrize(
        "unsafe_url",
        [
            "http://localhost:8080/admin",
            "http://127.0.0.1:8000/internal",
            "http://0.0.0.0:8000",
            "http://broadcasthost/test",
            "http://10.0.0.1/secrets",
            "http://172.16.0.5/aws",
            "http://192.168.1.1/router",
            "http://169.254.169.254/latest/meta-data/",  # AWS / Cloud Instance Metadata
            "http://[::1]/admin",
            "http://[fe80::1]/secrets",
            "http://[fc00::1]/private",
            "ftp://example.com/test",
            "file:///etc/passwd",
            "data:text/html,<h1>evil</h1>",
        ],
    )
    def test_ssrf_rejects_unsafe_destinations(self, unsafe_url):
        assert _is_safe_url(unsafe_url) is False
        assert _resolve_and_validate_url(unsafe_url) is None

    def test_ssrf_rejects_multi_ip_dns_if_one_ip_is_private(self):
        """If a host returns public and private IPs, fail closed."""
        fake_addrs = [
            (2, 1, 6, "", ("93.184.216.34", 443)),
            (2, 1, 6, "", ("127.0.0.1", 443)),
        ]
        with mock.patch("app.agent.agent_engine.socket.getaddrinfo", return_value=fake_addrs):
            assert _is_safe_url("https://dual-homed.example.com") is False
            assert _resolve_and_validate_url("https://dual-homed.example.com") is None

    def test_ssrf_accepts_and_pins_public_ip(self):
        fake_addrs = [(2, 1, 6, "", ("93.184.216.34", 443))]
        with mock.patch("app.agent.agent_engine.socket.getaddrinfo", return_value=fake_addrs):
            info = _resolve_and_validate_url("https://careers.validcompany.com/apply")
            assert info is not None
            assert info["original_hostname"] == "careers.validcompany.com"
            assert info["pinned_ip"] == "93.184.216.34"
            assert info["target_url"] == "https://93.184.216.34:443/apply"
            assert info["headers"] == {"Host": "careers.validcompany.com"}


# ============================================================================
# 3. WS-06 SERVER-SIDE SESSION TERMINATION (KILL SWITCH) TESTS
# ============================================================================

class TestKillSwitchAndSessionLifecycle:
    """Verify real server-side session termination and two-user authorization."""

    @pytest.mark.asyncio
    async def test_session_lifecycle_and_cancellation(self, monkeypatch):
        _SESSIONS.clear()
        provider = LocalPlaywrightProvider()
        monkeypatch.setattr("app.services.browser_automation.session.get_provider", lambda: provider)
        
        # Open session for user A
        session = await open_session("run-100", "user-A")
        assert is_cancelled("run-100") is False
        assert session.run_id == "run-100"

        # User B attempts to cancel -> rejected
        with pytest.raises(BrowserAuthzError):
            await cancel_run("run-100", owner_id="user-B")
        assert is_cancelled("run-100") is False

        # User A cancels -> session terminated and removed
        result = await cancel_run("run-100", owner_id="user-A")
        assert result is True
        assert session.cancelled is True
        assert "run-100" not in _SESSIONS
