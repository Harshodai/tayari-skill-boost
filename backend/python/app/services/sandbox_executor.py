import re
import logging
import urllib.parse
import socket
import ipaddress
from typing import Dict, Any, List, Optional
from app.agent.browser_operator import BrowserOperator

logger = logging.getLogger(__name__)


def _resolve_and_validate_url(url: str) -> Optional[Dict[str, Any]]:
    """
    Resolve hostname once, validate that every resolved IP address is globally routable
    (ip_obj.is_global is True), and return URL metadata preserving the original hostname.
    """
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return None
        hostname = parsed.hostname
        if not hostname:
            return None

        # Reject direct non-global hostnames
        if hostname.lower() in ("localhost", "0.0.0.0", "broadcasthost"):
            return None

        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        ip_list = socket.getaddrinfo(hostname, port)
        if not ip_list:
            return None

        for item in ip_list:
            ip_str = item[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            if not ip_obj.is_global:
                return None

        pinned_ip = ip_list[0][4][0]
        parsed = urllib.parse.urlparse(url)
        target_url = parsed._replace(netloc=f"{pinned_ip}:{port}").geturl()
        return {
            "original_url": url,
            "original_hostname": hostname,
            "pinned_ip": pinned_ip,
            "target_url": target_url,
            "headers": {"Host": hostname}
        }
    except Exception:
        return None


# Patterns for sensitive government identifiers and private data
# Narrowed: [A-Z0-9]{8,9} -> [A-Z]{1,2}[0-9]{6,7} to avoid broad uppercase tokens like POSTGRES/REQ12345
SENSITIVE_PATTERNS = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[REDACTED_SSN]"),
    (re.compile(r"\b\d{9}\b"), "[REDACTED_TIN]"),
    (re.compile(r"\b[A-Z]{1,2}[0-9]{6,7}\b"), "[REDACTED_PASSPORT]"),
]


class TayariComputerSandboxExecutor:
    """
    Tayari Computer Accessibility Snapshot Sandbox Executor.
    Drives Playwright using Accessibility Snapshots (page.accessibility.snapshot())
    to discover form input roles semantically without relying on brittle CSS selectors.
    Tokenizes candidate profile injections locally while redacting sensitive government identifiers.
    """

    def __init__(self):
        self.browser = BrowserOperator()

    async def close(self):
        """Release browser operator resources."""
        if hasattr(self, "browser") and self.browser:
            await self.browser.close()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    def _redact_value(self, val: Any) -> Any:
        """Apply SENSITIVE_PATTERNS to a single string value."""
        if isinstance(val, str):
            redacted = val
            for pattern, replacement in SENSITIVE_PATTERNS:
                redacted = pattern.sub(replacement, redacted)
            return redacted
        return val

    def redact_sensitive_data(self, profile: Any) -> Any:
        """Redact sensitive government identifiers and private credentials locally.
        Applies to all string values regardless of key name. Recursively handles
        dicts and lists while preserving non-string values.
        """
        if isinstance(profile, dict):
            return {k: self.redact_sensitive_data(v) for k, v in profile.items()}
        elif isinstance(profile, list):
            return [self.redact_sensitive_data(item) for item in profile]
        else:
            return self._redact_value(profile)

    async def execute_form_auto_fill(self, form_url: str, candidate_profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute semantic form auto-fill using Accessibility Snapshot.
        Discovers form input roles, textboxes, and buttons without relying on brittle CSS.
        """
        clean_profile = self.redact_sensitive_data(candidate_profile)

        # Validate URL using the established mechanism
        url_info = _resolve_and_validate_url(form_url)
        if not url_info:
            return {
                "success": False,
                "error": f"Rejected URL '{form_url}': unsafe scheme or non-public address.",
                "form_url": form_url
            }

        nav_res = await self.browser.navigate(url_info["target_url"], headers=url_info["headers"])
        if not nav_res.get("success"):
            await self.close()
            return {
                "success": False,
                "error": f"Failed to navigate to form URL: {nav_res.get('error')}",
                "form_url": form_url
            }

        accessibility_nodes = []
        if self.browser.page:
            try:
                snapshot = await self.browser.page.accessibility.snapshot()
                if snapshot:
                    accessibility_nodes = self._extract_input_roles(snapshot)
            except Exception as e:
                logger.warning(f"Accessibility snapshot warning: {e}")

        # Role-to-field mapping with specific tokens evaluated before generic ones
        # Only map fields that have values in clean_profile
        role_field_map = {
            "textbox": [
                ("email", "email"),
                ("phone", "phone"),
                ("company", "company"),
                ("name", "name"),
            ],
            "searchbox": [
                ("email", "email"),
                ("name", "name"),
            ],
        }

        actions = []
        any_real_action = False

        # Perform semantic mapping with actual fill operations
        for input_node in accessibility_nodes:
            role = input_node.get("role", "")
            name = input_node.get("name", "").lower()

            if role in role_field_map:
                for token, profile_key in role_field_map[role]:
                    if token in name:
                        # Only fill if the profile has this key
                        if profile_key in clean_profile and clean_profile[profile_key]:
                            val = clean_profile[profile_key]
                            if self.browser.page:
                                try:
                                    # Attempt actual fill operation
                                    fill_res = await self.browser.fill(input_node.get("name", ""), val)
                                    if fill_res.get("success"):
                                        actions.append(f"Filled {role} '{input_node.get('name')}' with '{val}'")
                                        any_real_action = True
                                    else:
                                        actions.append(f"Simulated fill {role} '{input_node.get('name')}' with '{val}' (fill failed: {fill_res.get('error')})")
                                except Exception as e:
                                    actions.append(f"Simulated fill {role} '{input_node.get('name')}' with '{val}' (error: {e})")
                            else:
                                actions.append(f"Simulated fill {role} '{input_node.get('name')}' with '{val}' (no page)")
                        # Skip field if profile key is absent or empty
                        break  # Use first matching token (specific before generic)

        # Fallback: if no accessibility nodes or no real actions, report discovery without claiming submit
        if not any_real_action:
            actions = [
                f"Discovered {len(accessibility_nodes)} semantic accessibility elements.",
                f"Available profile: name={clean_profile.get('name', 'Candidate')}, email={clean_profile.get('email', 'candidate@tayariskillboost.com')}",
            ]
            # Do NOT claim "Simulated Submit Button Click" unless it actually occurred

        await self.close()
        return {
            "success": any_real_action,
            "form_url": form_url,
            "engine": "Tayari Computer Accessibility Sandbox",
            "redacted_profile": clean_profile,
            "accessibility_nodes_found": len(accessibility_nodes),
            "actions_executed": actions,
            "simulated": not any_real_action,
        }

    def _extract_input_roles(self, node: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Recursively extract form input nodes from Accessibility Snapshot tree."""
        results = []
        role = node.get("role")
        if role in ("textbox", "combobox", "button", "checkbox", "radio"):
            results.append({
                "role": role,
                "name": node.get("name", "")
            })
        
        for child in node.get("children", []):
            results.extend(self._extract_input_roles(child))
            
        return results
