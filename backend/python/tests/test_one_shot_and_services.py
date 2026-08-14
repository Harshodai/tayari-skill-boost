"""
Unit tests for Candidate Answer Bank, ATS Detector, Truth Gate, Recruiter Intelligence, Offer Calculator, and Live Copilot.
"""
import pytest

pytest.importorskip("pydantic")

from app.services.candidate_answer_bank import (
    CandidateAnswers,
    get_answer_bank,
    match_question_to_answer,
)
from app.services.ats_detector import detect_ats_from_url
from app.guardrails.truth_gate import verify_resume_truthfulness
from app.services.recruiter_intelligence import generate_recruiter_intelligence
from app.services.offer_calculator import JobOfferInput, calculate_offer_comp


def test_candidate_answer_bank_sponsorship():
    bank = CandidateAnswers(requires_sponsorship=False)
    res = match_question_to_answer("Will you now or in the future require visa sponsorship?", bank)
    assert res["matched"] is True
    assert res["category"] == "sponsorship"
    assert "No" in res["answer"]


def test_candidate_answer_bank_missing_sensitive_value_requires_human():
    bank = CandidateAnswers()
    res = match_question_to_answer("Are you legally authorized to work in the United States?", bank)
    assert res["matched"] is False
    assert res["needs_human"] is True
    assert res["category"] == "work_authorization"
    assert bank.answers == {}


def test_candidate_answer_bank_rejects_synthetic_identity():
    with pytest.raises(ValueError):
        get_answer_bank("default_user")


def test_ats_detector_workday():
    rules = detect_ats_from_url("https://stripe.myworkdayjobs.com/careers/job/12345")
    assert rules.vendor == "workday"
    assert rules.single_column_required is True


def test_ats_detector_greenhouse():
    rules = detect_ats_from_url("https://boards.greenhouse.io/airbnb/jobs/98765")
    assert rules.vendor == "greenhouse"


def test_truth_gate_verification_pass():
    orig = "Built Go microservices at Stripe handling 10M daily events with 45% lower latency. B.S. in Computer Science."
    opt = "Engineered high-throughput Go microservices at Stripe processing 10M daily events, reducing latency by 45%. B.S. in Computer Science."
    res = verify_resume_truthfulness(orig, opt)
    assert res.passed is True
    assert res.truth_score == 100


def test_truth_gate_hallucination_detect():
    orig = "Software Engineer at Acme Corp. Experienced in Python and SQL."
    opt = "Senior Staff Software Engineer at Acme Corp. PhD in Artificial Intelligence, AWS Certified Solutions Architect."
    res = verify_resume_truthfulness(orig, opt)
    assert len(res.violations) >= 2
    assert res.truth_score < 75


def test_recruiter_intelligence_pattern():
    intel = generate_recruiter_intelligence("Stripe", "Senior Backend Engineer", "Sarah Jenkins")
    assert intel.company_domain == "stripe.com"
    assert "sarah.jenkins@stripe.com" in intel.suggested_emails


def test_offer_calculator():
    offer = JobOfferInput(
        company_name="Stripe",
        job_title="Senior Software Engineer",
        base_salary=180000,
        annual_bonus_pct=15,
        signing_bonus=25000,
        equity_total_value=200000,
        equity_vesting_years=4
    )
    res = calculate_offer_comp(offer)
    assert res.year_1_total_comp > 250000
    assert res.breakdown["base_salary"] == 180000


@pytest.mark.asyncio
async def test_typst_compile_endpoint_base64_encoding(monkeypatch):
    import base64
    from app.main import typst_compile_endpoint

    mock_pdf_bytes = b"%PDF-1.4 mock pdf binary header and content"
    monkeypatch.setattr("app.export.typst_exporter.compile_typst_to_pdf", lambda code: mock_pdf_bytes)

    payload = {
        "template": "modern_tech",
        "resume_data": {"full_name": "Test User", "email": "test@example.com"}
    }
    result = await typst_compile_endpoint(payload)
    assert result["pdf_available"] is True

    pdf_data = result.get("pdf_data")
    assert isinstance(pdf_data, str)
    decoded = base64.b64decode(pdf_data, validate=True)
    assert decoded.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_typst_compile_endpoint_empty_bytes_fallback(monkeypatch):
    from app.main import typst_compile_endpoint

    # Test empty bytes payload
    monkeypatch.setattr("app.export.typst_exporter.compile_typst_to_pdf", lambda code: b"")
    payload = {"template": "modern_tech", "resume_data": {}}
    res_empty = await typst_compile_endpoint(payload)
    assert res_empty["pdf_available"] is False
    assert "pdf_data" not in res_empty

    # Test non-bytes payload
    monkeypatch.setattr("app.export.typst_exporter.compile_typst_to_pdf", lambda code: None)
    res_none = await typst_compile_endpoint(payload)
    assert res_none["pdf_available"] is False
    assert "pdf_data" not in res_none


def test_pdf_exporter_escapes_user_text(monkeypatch):
    from app.export import pdf_exporter
    from app.export.pdf_exporter import PDFExporter

    captured = []

    def fake_write_pdf(**kwargs):
        captured.append(kwargs)
        return b"%PDF-1.4 mock pdf"

    monkeypatch.setattr(pdf_exporter, "_write_pdf", fake_write_pdf)

    exporter = PDFExporter()
    script_payload = "<script>alert('xss')</script>"
    pdf_out = exporter.export_to_pdf(script_payload)
    assert pdf_out == b"%PDF-1.4 mock pdf"
    assert captured[-1]["summary"] == script_payload

    resume_payload = {
        "contact": {"name": "<b>Jane</b>"},
        "summary": script_payload,
    }
    export_out = exporter.export(resume_payload)
    assert export_out == b"%PDF-1.4 mock pdf"
    assert captured[-1]["contact"]["name"] == "<b>Jane</b>"

    assert pdf_exporter._text("  unsafe\x00 value ") == "unsafe value"
    assert pdf_exporter.escape("<script>") == "&lt;script&gt;"

