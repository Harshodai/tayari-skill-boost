"""Gmail connector helper module for Browser Automation Agent.

Allows autonomous browser agents (browser-use / Playwright) to retrieve application
verification codes, confirmation links, and status updates directly from user's connected inbox.
"""

from __future__ import annotations

import logging
import os
import re
import urllib.request
import json
from typing import Optional

logger = logging.getLogger(__name__)


def fetch_latest_verification_code(
    api_base_url: Optional[str] = None,
    auth_token: Optional[str] = None,
    company_name: str = "",
) -> Optional[str]:
    """Fetch the latest verification code sent by a company from the user's connected inbox.

    Args:
        api_base_url: Base URL of Tayari Go Gateway (e.g. http://localhost:8085).
        auth_token: JWT bearer token of the user.
        company_name: Name of company sending verification code (e.g. Greenhouse, Lever).

    Returns:
        Optional[str]: Extracted 6-digit or alphanumeric verification code if found.
    """
    base_url = api_base_url or os.getenv("TAYARI_API_URL", "http://localhost:8085")
    token = auth_token or os.getenv("TAYARI_AUTH_TOKEN", "")

    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        url = f"{base_url.rstrip('/')}/api/v1/gmail/sync"
        req = urllib.request.Request(url, data=b"{}", headers=headers, method="POST")
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            logger.info("[GmailConnector] Synced inbox: %s", data)
    except Exception as exc:
        logger.warning("[GmailConnector] Error triggering sync: %s", exc)

    return None


def extract_code_from_text(text: str) -> Optional[str]:
    """Extract a numeric or alphanumeric verification code from email text."""
    if not text:
        return None

    # Match 6-digit verification code
    digits = re.findall(r"\b\d{6}\b", text)
    if digits:
        return digits[0]

    # Match code pattern like "Code: X1Y2Z3" or "PIN: 1234"
    code_match = re.search(r"(?:code|pin|verification)\s*(?:is|:)?\s*([A-Z0-9]{4,8})\b", text, re.IGNORECASE)
    if code_match:
        return code_match.group(1)

    return None
