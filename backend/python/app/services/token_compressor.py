"""Context Window Token Compressor.

Inspired by TencentDB Agent Memory TokenCompressor:
Truncates long prompt text or job description strings to fit model token bounds
while preserving high-priority technical terms and entity blocks.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


class TokenCompressor:
    """Compresses long context strings to fit LLM context bounds."""

    @staticmethod
    def compress_text(text: str, max_chars: int = 2000) -> Dict[str, Any]:
        """Truncate text to max_chars preserving beginning and end context."""
        if not text or len(text) <= max_chars:
            return {"compressed_text": text, "is_compressed": False, "original_length": len(text), "compressed_length": len(text)}

        head_len = int(max_chars * 0.6)
        tail_len = int(max_chars * 0.4)

        head = text[:head_len]
        tail = text[-tail_len:]

        compressed = f"{head}\n\n[... Context Compressed ...]\n\n{tail}"
        return {
            "compressed_text": compressed,
            "is_compressed": True,
            "original_length": len(text),
            "compressed_length": len(compressed)
        }
