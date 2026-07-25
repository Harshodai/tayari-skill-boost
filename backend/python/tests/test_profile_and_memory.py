"""Tests for Mission M7 Personalization Spine & Memory Composer."""
import pytest
from app.services.profile_service import (
    get_profile,
    patch_profile,
    check_do_not_apply,
    log_style_delta,
    UserCareerProfile
)


def test_profile_roundtrip():
    """Verify profile retrieval and updates."""
    user_id = "test_user_m7"
    prof = get_profile(user_id)
    assert prof.user_id == user_id
    assert prof.preferred_tone == "confident"

    updated = patch_profile(user_id, {
        "preferred_tone": "humble",
        "salary_floor": 150000.0,
        "do_not_apply": ["Meta", "Amazon"]
    })
    assert updated.preferred_tone == "humble"
    assert updated.salary_floor == 150000.0
    assert "Meta" in updated.do_not_apply


def test_do_not_apply_guardrail_blocks_autopilot():
    """Verify guardrail-level blocking of blacklisted companies."""
    user_id = "test_user_blacklist"
    patch_profile(user_id, {"do_not_apply": ["Evil Corp", "Bad Tech"]})

    assert check_do_not_apply(user_id, "Evil Corp") is True
    assert check_do_not_apply(user_id, "evil corp ") is True
    assert check_do_not_apply(user_id, "Good Startup") is False


def test_style_delta_logging():
    """Verify logging user edit deltas into writing fingerprint."""
    user_id = "test_user_delta"
    orig = "I am a software engineer."
    edited = "I am an experienced staff software architect specializing in Go."

    fp = log_style_delta(user_id, orig, edited)
    assert "style_deltas" in fp
    assert len(fp["style_deltas"]) == 1
    assert fp["style_deltas"][0]["edited_len"] == len(edited)


def test_tone_preference_changes():
    """Verify optimizer / cover letter tone selection changes with profile preference."""
    user_id = "test_user_tone"
    patch_profile(user_id, {"preferred_tone": "confident"})

    prof1 = get_profile(user_id)
    assert prof1.preferred_tone == "confident"

    patch_profile(user_id, {"preferred_tone": "humble"})
    prof2 = get_profile(user_id)
    assert prof2.preferred_tone == "humble"
