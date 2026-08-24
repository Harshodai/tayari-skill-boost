from app.services.job_identity import attach_job_identity, job_identity, normalize_job_url


def test_normalize_job_url_removes_tracking_and_fragment():
    assert normalize_job_url(
        "HTTPS://Jobs.Example.com/jobs/42/?utm_source=newsletter&gh_jid=42#apply"
    ) == "https://jobs.example.com/jobs/42?gh_jid=42"


def test_same_posting_with_tracking_urls_has_same_identity():
    base = {"provider": "Greenhouse", "title": "Backend Engineer", "company": "Acme", "location": "Remote"}
    first = job_identity({**base, "url": "https://jobs.example.com/42?utm_source=a"})
    second = job_identity({**base, "url": "https://jobs.example.com/42?utm_medium=email"})
    assert first["key"] == second["key"]
    assert first["source_url"] == "https://jobs.example.com/42"


def test_identity_changes_when_source_job_changes():
    base = {"provider": "Greenhouse", "title": "Backend Engineer", "company": "Acme", "location": "Remote"}
    first = job_identity({**base, "url": "https://jobs.example.com/42"})
    second = job_identity({**base, "url": "https://jobs.example.com/43"})
    assert first["key"] != second["key"]


def test_attach_identity_does_not_mutate_input_and_preserves_observed_provenance():
    original = {"title": "Backend Engineer", "company": "Acme", "url": "https://jobs.example.com/42"}
    enriched = attach_job_identity(original)
    assert "job_identity" not in original
    assert enriched["job_identity"]["source_url"] == "https://jobs.example.com/42"
    assert enriched["job_identity"]["observed_at"].endswith("+00:00")
