from app.services.recruiter_intelligence import find_recruiter_intel, generate_recruiter_intelligence


def test_find_recruiter_intel_does_not_crash():
    # ponytail: regression test for a real production crash — find_recruiter_intel
    # referenced res.job_title, a field RecruiterContact never defines, so every
    # call raised AttributeError. This is the live code path for both
    # /api/v1/recruiter/patterns (RecruiterOutreach.tsx) and the One-Shot
    # Pipeline's Stage 5 (Recruiter Intelligence & Outreach) — both were 100%
    # broken. Must return a well-formed dict, not raise.
    res = find_recruiter_intel("Acme", "Senior Engineer")
    assert res["company"] == "Acme"
    assert res["role"] == "Senior Engineer"
    assert "cold_email" in res
    assert res["cold_email"]["subject"]
    assert res["cold_email"]["body"]
    assert res["linkedin_note"]
    assert len(res["patterns"]) == 5


def test_generate_recruiter_intelligence_uses_real_skills_when_provided():
    res = generate_recruiter_intelligence(
        company_name="Acme",
        job_title="Staff Engineer",
        hiring_manager_name="Jane Doe",
        user_name="Alex Candidate",
        user_skills=["Kubernetes", "Distributed Systems"],
    )
    assert "Kubernetes" in res.cold_outreach_body
    assert "Alex Candidate" in res.cold_outreach_body
    assert res.suggested_emails[0] == "jane.doe@acme.com"
