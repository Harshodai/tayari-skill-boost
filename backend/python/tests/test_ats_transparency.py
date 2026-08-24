from app.services.ats_engine import heuristic_ats_score


def test_ats_score_exposes_evidence_and_unsupported_claim_uncertainty():
    result = heuristic_ats_score(
        "Email candidate@example.com\nExperience\nSkills: Python SQL",
        "Backend Engineer\nPython SQL Kubernetes",
    )
    assert result["score_before_penalties"] >= result["score"]
    assert result["evidence"]["keyword_coverage_pct"] is not None
    assert result["evidence"]["unsupported_claims"]["status"] == "not_evaluated"
    assert result["evidence"]["unsupported_claims"]["penalty"] == 0


def test_repeated_job_terms_are_reported_and_penalized():
    resume = " ".join(["Python"] * 10) + "\nEmail candidate@example.com\nExperience\nSkills"
    result = heuristic_ats_score(resume, "Backend Engineer Python")
    stuffing = result["evidence"]["stuffing"]
    assert stuffing["status"] == "evaluated"
    assert stuffing["stuffing_penalty"] > 0
    assert any(item["term"] == "python" for item in stuffing["repeated_terms"])
    assert result["score"] < result["score_before_penalties"]


def test_stuffing_is_not_evaluated_without_a_job_description():
    result = heuristic_ats_score("Email candidate@example.com\nExperience")
    assert result["evidence"]["stuffing"]["status"] == "not_evaluated"
    assert result["evidence"]["stuffing"]["stuffing_penalty"] == 0
