"""Personalization Spine — Profile Service for Tayari AI."""
import logging
import threading
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class UserCareerProfile(BaseModel):
    user_id: str
    target_roles: List[str] = Field(default_factory=lambda: ["Software Engineer"])
    locations: List[str] = Field(default_factory=lambda: ["Remote"])
    salary_floor: float = 100000.0
    preferred_tone: str = "confident"  # "confident" | "balanced" | "humble"
    do_not_apply: List[str] = Field(default_factory=list)
    consent_flags: Dict[str, bool] = Field(default_factory=lambda: {
        "auto_move_kanban": False,
        "autopilot_submit": False,
    })
    writing_style_fingerprint: Dict[str, Any] = Field(default_factory=dict)
    skill_inventory: List[str] = Field(default_factory=list)


# In-memory store for fast profile state management & fallbacks
_PROFILES_STORE: Dict[str, UserCareerProfile] = {}
_PROFILE_LOCK = threading.Lock()


def get_profile(user_id: str) -> UserCareerProfile:
    """Retrieve user profile, returning default profile if absent."""
    if user_id not in _PROFILES_STORE:
        _PROFILES_STORE[user_id] = UserCareerProfile(user_id=user_id)
    return _PROFILES_STORE[user_id]


def patch_profile(user_id: str, updates: Dict[str, Any]) -> UserCareerProfile:
    """Patch user profile fields inside thread lock critical section."""
    with _PROFILE_LOCK:
        profile = get_profile(user_id)
        data = profile.model_dump()
        for k, v in updates.items():
            if k in data and v is not None:
                data[k] = v
        updated = UserCareerProfile(**data)
        _PROFILES_STORE[user_id] = updated
        return updated


def check_do_not_apply(user_id: str, company: str) -> bool:
    """Check if a company is on the user's do-not-apply list (Guardrail Level)."""
    if not company:
        return False
    profile = get_profile(user_id)
    company_lower = company.strip().lower()
    for blacklisted in profile.do_not_apply:
        if blacklisted.strip().lower() == company_lower:
            return True
    return False


def log_style_delta(user_id: str, original_text: str, edited_text: str) -> Dict[str, Any]:
    """Log user edit delta as an append-only style signal into fingerprint."""
    profile = get_profile(user_id)
    fingerprint = dict(profile.writing_style_fingerprint)
    deltas = fingerprint.get("style_deltas", [])
    deltas.append({
        "original_len": len(original_text),
        "edited_len": len(edited_text),
        "diff_ratio": round(len(edited_text) / max(1, len(original_text)), 2)
    })
    fingerprint["style_deltas"] = deltas[-20:]  # Keep last 20 deltas
    patch_profile(user_id, {"writing_style_fingerprint": fingerprint})
    return fingerprint
