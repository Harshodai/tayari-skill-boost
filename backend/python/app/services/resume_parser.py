'''Resume parsing and knowledge‑graph construction.

This module provides a thin wrapper around the optional ``open_resume`` library.
If the library is installed, ``parse_resume`` will return a structured graph
representing the resume (entities, relationships, achievements). If the library
is not available, the function returns ``None`` and logs a warning.
'''

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

try:
    from open_resume import parse_resume as _parse_resume  # type: ignore
except Exception:  # pragma: no cover
    _parse_resume = None  # library not installed


def parse_resume(resume_text: str) -> Optional[Any]:
    """Parse resume text into a knowledge‑graph representation.

    Args:
        resume_text: Raw resume string.
    Returns:
        Graph object or ``None`` if parsing unavailable.
    """
    if not _parse_resume:
        logger.warning("open_resume library not installed – resume parsing skipped")
        return None
    try:
        return _parse_resume(resume_text)
    except Exception as exc:  # pragma: no cover
        logger.error("Failed to parse resume: %s", exc)
        return None
