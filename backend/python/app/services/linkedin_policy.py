"""LinkedIn automation policy — legal boundary, not a preference.

LinkedIn's User Agreement §8.2 prohibits bots, scrapers, and automated
interfaces. Enforcement is account termination of the *end user* — not us.
Any JobTayari feature that automates a LinkedIn action (submit, connect,
message, profile scrape, Easy Apply) puts the user's account at risk.

Policy: exclude LinkedIn from automated action entirely. LinkedIn stays
strictly read-only/manual. ATS portals (Greenhouse/Lever/Workday/Ashby/
SmartRecruiters) remain automatable; LinkedIn submissions/Easy Apply/connection
requests/messaging/profile scraping do not.

This module is the single chokepoint: automation_engine calls
``assert_not_linkedin_automation`` before any submit, and browser_library
calls it again as defense-in-depth.
"""

from __future__ import annotations

from urllib.parse import urlparse

__all__ = [
    "LINKEDIN_DOMAINS",
    "LinkedInAutomationBlocked",
    "is_linkedin_url",
    "is_linkedin_read_only",
    "assert_not_linkedin_automation",
    "assert_not_linkedin_easy_apply",
    "assert_not_linkedin_scrape",
    "assert_not_linkedin_messaging",
    "assert_not_linkedin_write",
]

LINKEDIN_DOMAINS = ("linkedin.com", "www.linkedin.com")

_ALLOWED_ACTIONS = frozenset({"view", "save", "read"})


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
    before parsing to avoid a hostless false-negative). Scheme-relative
    URLs (``//linkedin.com/...`` — "use the current scheme") are parsed
    as https so they cannot dodge the policy; only URLs with no scheme
    and no scheme-relative prefix get ``https://`` prepended. Trailing
    dots (``linkedin.com.`` — a DNS-valid FQDN form) are stripped before
    the apex/subdomain checks so a dot-terminated host cannot bypass the
    policy.
    """
    if not url or not isinstance(url, str):
        return False
    if url.startswith("//"):
        candidate = f"https:{url}"
    elif "://" in url:
        candidate = url
    else:
        candidate = f"https://{url}"
    parsed = urlparse(candidate)
    host = (parsed.hostname or "").rstrip(".").lower()
    return host == "linkedin.com" or host.endswith(".linkedin.com")


def is_linkedin_read_only(action: str) -> bool:
    """True only when the specified action is approved as strictly read-only."""
    if not action or not isinstance(action, str):
        return False
    return action.strip().lower() in _ALLOWED_ACTIONS


def assert_not_linkedin_automation(url: str, action: str) -> None:
    """Raise ``LinkedInAutomationBlocked`` for blocked actions on LinkedIn.

    Strict read-only actions ("view", "save", "read") are allowed — the user
    can still save a LinkedIn posting and prep a resume against it; they just
    submit manually. All write, Easy Apply, messaging, and scraping actions
    are strictly prohibited.
    """
    if is_linkedin_url(url) and not is_linkedin_read_only(action):
        raise LinkedInAutomationBlocked(url, action)


def assert_not_linkedin_easy_apply(url: str) -> None:
    """Block Easy Apply automation on LinkedIn."""
    assert_not_linkedin_automation(url, "easy_apply")


def assert_not_linkedin_scrape(url: str) -> None:
    """Block scraping on LinkedIn."""
    assert_not_linkedin_automation(url, "scrape")


def assert_not_linkedin_messaging(url: str) -> None:
    """Block automated messaging / InMail on LinkedIn."""
    assert_not_linkedin_automation(url, "message")


def assert_not_linkedin_write(url: str, action: str) -> None:
    """Block any write / form fill interaction on LinkedIn."""
    assert_not_linkedin_automation(url, action)