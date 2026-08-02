"""Unit tests for Phase 3 advanced adaptations."""

import pytest
from app.guardrails.ats_pdf_validator import ATSPDFValidator
from app.scoring.truth_subspace import TruthSubspaceEngine
from app.services.portal_scaffolder import PortalScaffolder
from app.memory.memory_exporter import MemorySaveEngine
from app.extraction.batch_scraper import BatchScraperEngine


def test_ats_pdf_validator_valid():
    sample_pdf = b"%PDF-1.4\n/Font << /F1 2 0 R >>\nBT /F1 12 Tf (Hello World) Tj ET\n"
    res = ATSPDFValidator.validate_pdf_bytes(sample_pdf)
    assert res["is_parseable"] is True

    assert res["score"] >= 70


def test_ats_pdf_validator_invalid():
    res = ATSPDFValidator.validate_pdf_bytes(b"Not a PDF file")
    assert res["is_parseable"] is False
    assert res["score"] == 0
    assert res["text_stream_objects_found"] == 0
    assert isinstance(res["recommendation"], str) and res["recommendation"]


def test_ats_pdf_validator_empty():
    res = ATSPDFValidator.validate_pdf_bytes(b"")
    assert res["is_parseable"] is False
    assert res["score"] == 0
    assert res["issues"] == ["Invalid or empty PDF file"]
    assert res["text_stream_objects_found"] == 0
    assert isinstance(res["recommendation"], str) and res["recommendation"]


def test_ats_pdf_validator_missing_header():
    res = ATSPDFValidator.validate_pdf_bytes(b"JPEG binary data here")
    assert res["is_parseable"] is False
    assert res["score"] == 0
    assert res["issues"] == ["File missing %PDF magic header"]
    assert res["text_stream_objects_found"] == 0
    assert isinstance(res["recommendation"], str) and res["recommendation"]


def test_truth_subspace_engine():
    candidate_text = "Experienced Python Go Developer with Kubernetes skills"
    jd_text = "Looking for Senior Python Developer with Kubernetes"
    vocab = ["python", "go", "kubernetes", "java"]

    res = TruthSubspaceEngine.compute_subspace_alignment(candidate_text, jd_text, vocab)
    assert res["alignment_score"] > 50
    assert res["truth_subspace_distance"] < 0.5


def test_portal_scaffolder():
    scaffolder = PortalScaffolder()
    config = scaffolder.scaffold_portal(
        portal_name="tech_jobs",
        base_url="https://techjobs.com",
        search_url_template="https://techjobs.com/search?q={query}",
        job_card_selector=".job-card",
        title_selector=".job-title",
        company_selector=".company-name"
    )
    assert config["name"] == "tech_jobs"
    assert scaffolder.get_portal("tech_jobs") is not None


def test_memory_save_engine():
    graph_dict = {"nodes": [{"id": "user:1"}], "links": []}
    persona = {"user_id": "u1", "skills": ["python"]}
    skills = [{"name": "interview_prep"}]

    save_str = MemorySaveEngine.export_save_file("u1", graph_dict, persona, skills)
    assert "TayariSkillBoost" in save_str

    imported = MemorySaveEngine.import_save_file(save_str)
    assert imported["status"] == "success"
    assert imported["user_id"] == "u1"


@pytest.mark.asyncio
async def test_batch_scraper_engine():
    urls = ["https://example.com/job/1"]
    results = await BatchScraperEngine.scrape_batch(urls)
    assert len(results) == 1
    assert "url" in results[0]
