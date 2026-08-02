"""Unit tests for Phase 6 advanced adaptations."""

import pytest
from app.services.answer_bank_service import AnswerBank, SponsorshipChecker
from app.scoring.hyde_engine import HyDEEngine
from app.memory.memory_cleaner import MemoryCleaner
from app.extraction.dom_cleaner import DOMCleaner


def test_answer_bank():
    ans = AnswerBank.get_answer("work_authorization")
    assert "Authorized" in ans


def test_sponsorship_checker():
    res1 = SponsorshipChecker.check_sponsorship_policy("Must be US Citizen, no sponsorship offered.")
    assert res1["policy"] == "NO_SPONSORSHIP"

    res2 = SponsorshipChecker.check_sponsorship_policy("H1B transfer accepted, visa sponsorship available.")
    assert res2["policy"] == "SPONSORSHIP_AVAILABLE"


def test_hyde_engine():
    jd = "Looking for Senior Python Developer with Docker and AWS experience."
    profile = HyDEEngine.generate_hypothetical_profile(jd, "Senior Python Developer")
    assert "Senior Python Developer" in profile["role_title"]
    assert "python" in profile["extracted_tech_requirements"]

    match = HyDEEngine.evaluate_hyde_match(["python", "docker"], profile)
    assert match["hyde_match_score"] >= 50


def test_hyde_engine_matches_tech_in_raw_text():
    jd = "Senior Go engineer for CI/CD pipelines with Kubernetes."
    profile = HyDEEngine.generate_hypothetical_profile(jd, "Go Engineer")
    reqs = profile["extracted_tech_requirements"]
    assert "go" in reqs
    assert "ci/cd" in reqs
    assert reqs == sorted(reqs)


def test_hyde_engine_omits_absent_tech():
    jd = "Looking for a React developer."
    profile = HyDEEngine.generate_hypothetical_profile(jd, "React Developer")
    reqs = profile["extracted_tech_requirements"]
    assert "react" in reqs
    assert "go" not in reqs
    assert "ci/cd" not in reqs
    assert reqs == sorted(reqs)


def test_memory_cleaner():
    assert MemoryCleaner.normalize_skill("python3") == "python"
    assert MemoryCleaner.normalize_skill("k8s") == "kubernetes"

    nodes = [{"name": "Python3"}, {"name": "Python"}, {"name": "Go"}]
    res = MemoryCleaner.consolidate_graph_nodes(nodes)
    assert res["nodes_merged"] == 1
    assert res["consolidated_count"] == 2


def test_dom_cleaner():
    html = "<html><head><style>body {color: red;}</style></head><body><h1>Job Title</h1><p>Description here</p></body></html>"
    res = DOMCleaner.sanitize_html_to_markdown(html)
    assert "### Job Title" in res["markdown"]
    assert "style" not in res["markdown"].lower()
