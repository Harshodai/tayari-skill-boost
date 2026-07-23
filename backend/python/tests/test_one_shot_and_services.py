"""
Unit tests for Candidate Answer Bank, ATS Detector, Truth Gate, Recruiter Intelligence, Offer Calculator, and Live Copilot.
"""
import pytest
from app.services.candidate_answer_bank import match_question_to_answer, CandidateAnswers
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
