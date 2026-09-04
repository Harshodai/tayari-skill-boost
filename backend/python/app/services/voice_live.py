"""Duplex-voice fail-closed seam — text coaching lives in voice_coach."""
from __future__ import annotations

import os
from typing import Any, Dict


def start_live_session(user_id: str, run_id: str) -> Dict[str, Any]:
    has_gemini = bool(os.environ.get("GEMINI_API_KEY", "").strip())
    has_openai = bool(os.environ.get("OPENAI_API_KEY", "").strip())
    if not has_gemini and not has_openai:
        # ponytail: fail closed with key names only — never log env values.
        return {
            "status": "unavailable",
            "reason": "voice_live_not_configured",
            "required_env": ["GEMINI_API_KEY or OPENAI_API_KEY"],
        }
    return {"status": "ready", "endpoint": "/api/v1/interview/stream"}


def connect_live_session(user_id: str, run_id: str) -> Any:
    # ponytail: socket protocol is the follow-up once keys + budget approved — stub only.
    raise NotImplementedError("duplex voice socket protocol not implemented")
