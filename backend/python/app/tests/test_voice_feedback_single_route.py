"""RED: /api/v1/interview/voice-feedback must have exactly ONE POST registration."""
from app.main import app


def test_voice_feedback_single_registration():
    matches = [
        r for r in app.routes
        if getattr(r, "path", None) == "/api/v1/interview/voice-feedback"
        and "POST" in getattr(r, "methods", set())
    ]
    assert len(matches) == 1, f"expected 1 POST route, found {len(matches)}"
