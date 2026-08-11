"""LinkedIn automation policy — legal boundary, not a preference.

LinkedIn's User Agreement §8.2 prohibits bots, scrapers, and automated
interfaces. Enforcement is account termination of the *end user* — not us.
Any JobTayari feature that automates a LinkedIn action (submit, connect,
message, profile scrape) puts the user's account at risk.

Policy: exclude LinkedIn from automated action entirely. LinkedIn stays
read-only/manual. ATS portals (Greenhouse/Lever/Workday/Ashby/
SmartRecruiters) remain automatable; LinkedIn submissions/connection
requests/profile scraping do not.

This module is the single chokepoint: automation_engine calls
``assert_not_linkedin_automation`` before any submit, and browser_library
calls it again as defense-in-depth.
"""

from __future__ import annotations

from urllib.parse import urlparse

LINKEDIN_DOMAINS = ("linkedin.com", "www.linkedin.com")

_BLOCKED_ACTIONS = frozenset(
    {"submit", "apply", "connect", "message", "scrape_profile"}
)


class LinkedInAutomationBlocked(RuntimeError):
    """Raised when an automated action targets a LinkedIn URL.

    Carries the offending URL and action so callers can log a clear
    skip reason and mark the application with a distinct status.
    """

    def __init__(self, url: str, action: str) -> None:
        self.url = url
        self.action = action
        super().__init__(
            f"LinkedIn automation not permitted by policy (UA §8.2): "
            f"action={action!r} url={url!r}"
        )


def is_linkedin_url(url: str) -> bool:
    """True when the URL's host is a LinkedIn domain.

    Tolerant of ``None``/empty (returns False) and of URLs without a
    scheme (urlparse treats those as path-only, so we prepend a scheme
    before parsing to avoid a hostless false-negative).
    """
    if not url or not isinstance(url, str):
        return False
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = (parsed.hostname or "").lower()
    return host in LINKEDIN_DOMAINS


def assert_not_linkedin_automation(url: str, action: str) -> None:
    """Raise ``LinkedInAutomationBlocked`` for blocked actions on LinkedIn.

    Read-only actions ("view", "save") are allowed — the user can still
    save a LinkedIn posting and prep a resume against it; they just
    submit manually.
    """
    if is_linkedin_url(url) and action in _BLOCKED_ACTIONS:
        raise LinkedInAutomationBlocked(url, action)