from __future__ import annotations
from dataclasses import dataclass
from hashlib import sha256
from typing import Any

@dataclass(frozen=True)
class UntrustedContent:
    source: str
    url: str
    text: str
    digest: str
    instruction_like: bool

def capture_page_content(text: str, url: str, source: str = 'browser_page') -> UntrustedContent:
    normalized = ' '.join(str(text or '').split())
    markers = ('ignore previous', 'system message', 'developer message', 'upload this file', 'reveal your prompt', 'send credentials')
    return UntrustedContent(source, url, normalized, sha256(normalized.encode()).hexdigest(), any(marker in normalized.lower() for marker in markers))

def as_model_context(content: UntrustedContent) -> dict[str, Any]:
    return {'content': content.text, 'provenance': {'source': content.source, 'url': content.url, 'sha256': content.digest, 'untrusted': True, 'instruction_like': content.instruction_like}}
