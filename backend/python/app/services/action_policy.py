from __future__ import annotations
from dataclasses import dataclass
from enum import StrEnum
import os
from urllib.parse import urlparse

class RiskTier(StrEnum):
    READ = 'read'
    NAVIGATION = 'navigation'
    DRAFT = 'draft'
    SENSITIVE = 'sensitive'
    EXTERNAL_WRITE = 'external_write'
    SUBMISSION = 'submission'

@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    requires_approval: bool
    risk_tier: RiskTier
    reason: str

SENSITIVE_TERMS = ('password', 'passcode', 'otp', 'one-time', 'captcha', 'social security', 'ssn', 'salary', 'compensation', 'work authorization', 'sponsorship', 'bank', 'credit card', 'date of birth', 'legal declaration')
SUBMIT_ACTIONS = {'submit_application', 'final_submit', 'send_message', 'accept_offer'}
WRITE_ACTIONS = {'click_element', 'select_option', 'input_text', 'upload_file', 'download_file'}


def allowed_origins() -> set[str]:
    configured = os.getenv('TAYARI_ALLOWED_ORIGINS', '')
    if configured.strip():
        return {item.strip().lower().rstrip('/') for item in configured.split(',') if item.strip()}
    return {'linkedin.com', 'indeed.com', 'greenhouse.io', 'lever.co', 'ashbyhq.com', 'workday.com', 'smartrecruiters.com'}

def origin(url: str) -> str:
    parsed = urlparse(url if '://' in url else f'https://{url}')
    return (parsed.hostname or '').lower()

def origin_allowed(url: str) -> bool:
    host = origin(url)
    return bool(host) and any(host == item or host.endswith('.' + item) for item in allowed_origins())

def _label(payload: dict) -> str:
    return ' '.join(str(payload.get(key, '')) for key in ('label', 'aria_label', 'name', 'type', 'text')).lower()

def evaluate_action(action: str, payload: dict | None = None, page_url: str = '', *, explicit_approval: bool = False) -> PolicyDecision:
    payload = payload or {}
    if action in SUBMIT_ACTIONS:
        return PolicyDecision(False, True, RiskTier.SUBMISSION, 'Final application submission is disabled; the candidate must submit manually.')
    if action in {'go_to_url', 'navigate'}:
        target = str(payload.get('url') or '')
        if not target or not origin_allowed(target):
            return PolicyDecision(False, True, RiskTier.NAVIGATION, 'Navigation target is outside the approved job-site allowlist.')
        return PolicyDecision(True, False, RiskTier.NAVIGATION, 'Approved job-site navigation.')
    if action in {'read_page', 'extract_text', 'get_accessibility_tree'}:
        return PolicyDecision(True, False, RiskTier.READ, 'Read-only action.')
    if action in WRITE_ACTIONS:
        if action == 'upload_file':
            return PolicyDecision(False, True, RiskTier.SENSITIVE, 'Local file access requires explicit desktop approval.')
        if any(term in _label(payload) for term in SENSITIVE_TERMS):
            return PolicyDecision(False, True, RiskTier.SENSITIVE, 'Sensitive fields always require explicit approval.')
        if explicit_approval:
            return PolicyDecision(True, False, RiskTier.DRAFT, 'Explicit candidate approval recorded.')
        return PolicyDecision(False, True, RiskTier.EXTERNAL_WRITE, 'Browser writes require explicit candidate approval.')
    return PolicyDecision(False, True, RiskTier.EXTERNAL_WRITE, 'Unknown browser action is denied by default.')
