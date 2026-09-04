"""Comprehensive unit test suite for Tayari guardrails package.

Covers:
- PipelineGate (gate.py)
- Truthfulness guardrail (truthfulness.py)
- Keyword stuffing guardrail (keyword_stuffing.py)
- PII detector (pii_detector.py)
- ATS PDF validator (ats_pdf_validator.py)
- Entity disambiguator (entity_disambiguator.py)
"""
from __future__ import annotations

import pytest

from app.guardrails.ats_pdf_validator import ATSPDFValidator
from app.guardrails.entity_disambiguator import EntityDisambiguator
from app.guardrails.gate import PipelineGate
from app.guardrails.keyword_stuffing import check_keyword_stuffing
from app.guardrails.pii_detector import check_pii
from app.guardrails.truthfulness import check_truthfulness


# ---------------------------------------------------------------------------
# Test Fixtures & Sample Resumes
# ---------------------------------------------------------------------------

SAMPLE_ORIGINAL_RESUME = """Jane Doe
EDUCATION
Bachelor of Science in Computer Science, BS degree, 2021
EXPERIENCE
Software Engineer at Acme Corp, 2021-2023
- Engineered backend microservices using Python and PostgreSQL, improving API response times by 25%.
- Maintained cloud CI/CD deployment pipelines on AWS and Docker for web applications.
SKILLS
Python, PostgreSQL, Docker, AWS, Git
"""

SAMPLE_OPTIMIZED_CLEAN_RESUME = """Jane Doe
EDUCATION
Bachelor of Science in Computer Science, BS degree, 2021
EXPERIENCE
Software Engineer at Acme Corp, 2021-2023
- Engineered backend microservices using Python and PostgreSQL, improving API response times by 25%.
- Maintained cloud CI/CD deployment pipelines on AWS and Docker for web applications.
SKILLS
Python, PostgreSQL, Docker, AWS, Git
"""


# ---------------------------------------------------------------------------
# 1. PipelineGate Tests (gate.py)
# ---------------------------------------------------------------------------

class TestPipelineGate:
    """Tests for PipelineGate orchestration."""

    def test_pipeline_gate_clean_pass(self):
        """Clean pass when all guardrails pass."""
        gate = PipelineGate(skip_pii=False, require_truthfulness=True)
        res = gate.check(
            optimized_text=SAMPLE_OPTIMIZED_CLEAN_RESUME,
            original_text=SAMPLE_ORIGINAL_RESUME,
        )
        assert res["all_passed"] is True
        assert res["results"]["truthfulness"]["passed"] is True
        assert res["results"]["truthfulness"]["verified"] is True
        assert res["results"]["keyword_stuffing"]["passed"] is True
        assert res["results"]["pii"]["passed"] is True

    def test_pipeline_gate_fail_closed_missing_original_text(self):
        """Fail-closed when original_text is missing (truthfulness cannot be verified)."""
        gate = PipelineGate(require_truthfulness=True)
        res = gate.check(optimized_text=SAMPLE_OPTIMIZED_CLEAN_RESUME, original_text=None)

        assert res["all_passed"] is False
        assert res["results"]["truthfulness"]["passed"] is False
        assert res["results"]["truthfulness"]["verified"] is False
        assert any(
            "original_text not provided" in v
            for v in res["results"]["truthfulness"]["violations"]
        )

    def test_pipeline_gate_require_truthfulness_false_flag(self):
        """When require_truthfulness=False and original_text is missing, passed is True but verified is False."""
        gate = PipelineGate(require_truthfulness=False)
        res = gate.check(optimized_text=SAMPLE_OPTIMIZED_CLEAN_RESUME, original_text=None)

        assert res["results"]["truthfulness"]["passed"] is True
        assert res["results"]["truthfulness"]["verified"] is False
        assert res["all_passed"] is True

    def test_pipeline_gate_skip_pii_flag_behavior(self):
        """skip_pii=True bypasses PII inspection even if text contains sensitive PII."""
        text_with_pii = SAMPLE_OPTIMIZED_CLEAN_RESUME + "\nSSN: 123-45-6789"

        # With skip_pii=True -> passes
        gate_skip = PipelineGate(skip_pii=True)
        res_skip = gate_skip.check(
            optimized_text=text_with_pii,
            original_text=SAMPLE_ORIGINAL_RESUME,
        )
        assert res_skip["results"]["pii"]["passed"] is True
        assert res_skip["results"]["pii"]["pii_found"] == []

        # With skip_pii=False -> fails
        gate_no_skip = PipelineGate(skip_pii=False)
        res_no_skip = gate_no_skip.check(
            optimized_text=text_with_pii,
            original_text=SAMPLE_ORIGINAL_RESUME,
        )
        assert res_no_skip["results"]["pii"]["passed"] is False
        assert len(res_no_skip["results"]["pii"]["pii_found"]) > 0
        assert res_no_skip["all_passed"] is False

    def test_pipeline_gate_failure_on_keyword_stuffing(self):
        """PipelineGate reports failure when keyword stuffing is detected."""
        stuffed_text = SAMPLE_OPTIMIZED_CLEAN_RESUME + "\n" + ("Python " * 40)
        gate = PipelineGate()
        res = gate.check(
            optimized_text=stuffed_text,
            original_text=SAMPLE_ORIGINAL_RESUME,
        )
        assert res["all_passed"] is False
        assert res["results"]["keyword_stuffing"]["passed"] is False
        assert len(res["results"]["keyword_stuffing"]["flagged_keywords"]) > 0

    def test_pipeline_gate_failure_on_pii(self):
        """PipelineGate reports failure when PII is detected."""
        text_with_pii = SAMPLE_OPTIMIZED_CLEAN_RESUME + "\nTax ID: 999-12-3456"
        gate = PipelineGate(skip_pii=False)
        res = gate.check(
            optimized_text=text_with_pii,
            original_text=SAMPLE_ORIGINAL_RESUME,
        )
        assert res["all_passed"] is False
        assert res["results"]["pii"]["passed"] is False
        assert any(item["type"] == "SSN" for item in res["results"]["pii"]["pii_found"])

    def test_pipeline_gate_failure_on_hallucinated_degrees(self):
        """PipelineGate reports failure when truthfulness check catches hallucinations."""
        hallucinated_text = SAMPLE_OPTIMIZED_CLEAN_RESUME + "\nAcquired PhD and MBA in AI."
        gate = PipelineGate()
        res = gate.check(
            optimized_text=hallucinated_text,
            original_text=SAMPLE_ORIGINAL_RESUME,
        )
        assert res["all_passed"] is False
        assert res["results"]["truthfulness"]["passed"] is False


# ---------------------------------------------------------------------------
# 2. Truthfulness Guardrail Tests (truthfulness.py)
# ---------------------------------------------------------------------------

class TestTruthfulnessGuardrail:
    """Tests for factual drift and hallucination detection."""

    def test_clean_resume_without_hallucinations_passes(self):
        """Clean resume matching original credentials and facts passes."""
        res = check_truthfulness(SAMPLE_ORIGINAL_RESUME, SAMPLE_OPTIMIZED_CLEAN_RESUME)
        assert res["passed"] is True
        assert res["violations"] == []
        assert res["claim_ledger"]["all_grounded"] is True

    def test_hallucinated_degrees_fail(self):
        """Invented credentials (e.g. PhD, MBA when original only had BS) fail."""
        opt_with_hallucination = SAMPLE_ORIGINAL_RESUME + "\nDegrees: PhD, MBA, MD"
        res = check_truthfulness(SAMPLE_ORIGINAL_RESUME, opt_with_hallucination)
        assert res["passed"] is False
        assert any("New credentials not in original" in v for v in res["violations"])
        assert any("phd" in v and "mba" in v for v in res["violations"])

    def test_dropped_employers_triggers_rewrite_drift(self):
        """Dropping 3+ employers triggers rewrite drift warning and fails."""
        orig_multi_employer = """Jane Doe
EXPERIENCE
Software Engineer at Alpha Corp, 2019
Backend Developer with Beta Corp, 2020
Tech Lead for Gamma Systems, 2021
Cloud Architect at Delta Cloud, 2022
"""
        # Optimized dropped Alpha, Beta, and Gamma (3 dropped employers)
        opt_single_employer = """Jane Doe
EXPERIENCE
Cloud Architect at Delta Cloud, 2022
"""
        res = check_truthfulness(orig_multi_employer, opt_single_employer)
        assert res["passed"] is False
        assert any("Many employers dropped (3): possible rewrite drift." in v for v in res["violations"])

    def test_dropping_fewer_than_three_employers_does_not_trigger_drift(self):
        """Dropping 1 or 2 employers does not trigger hard rewrite drift failure."""
        orig = """Jane Doe
EXPERIENCE
Software Engineer at Alpha Corp, 2019
Backend Developer with Beta Corp, 2020
Tech Lead for Gamma Systems, 2021
"""
        # Dropped only Alpha Corp (1 dropped)
        opt_one_dropped = """Jane Doe
EXPERIENCE
Backend Developer with Beta Corp, 2020
Tech Lead for Gamma Systems, 2021
"""
        res1 = check_truthfulness(orig, opt_one_dropped)
        assert not any("Many employers dropped" in v for v in res1["violations"])

        # Dropped Alpha Corp and Beta Corp (exactly 2 dropped)
        opt_two_dropped = """Jane Doe
EXPERIENCE
Tech Lead for Gamma Systems, 2021
"""
        res2 = check_truthfulness(orig, opt_two_dropped)
        assert not any("Many employers dropped" in v for v in res2["violations"])

    def test_email_drift_triggers_violation(self):
        """Changing contact email triggers identity drift violation."""
        orig_with_email = SAMPLE_ORIGINAL_RESUME + "\nContact: alice.smith@example.com"
        opt_changed_email = SAMPLE_OPTIMIZED_CLEAN_RESUME + "\nContact: bob.jones@example.com"

        res = check_truthfulness(orig_with_email, opt_changed_email)
        assert res["passed"] is False
        assert any("Contact email changed — possible identity drift." in v for v in res["violations"])

    def test_matching_email_passes(self):
        """Preserving candidate email passes truthfulness identity check."""
        orig = SAMPLE_ORIGINAL_RESUME + "\nContact: jane.doe@example.com"
        opt = SAMPLE_OPTIMIZED_CLEAN_RESUME + "\nContact: jane.doe@example.com"
        res = check_truthfulness(orig, opt)
        assert not any("Contact email changed" in v for v in res["violations"])

    def test_invented_years_fail(self):
        """New years not present in original resume fail truthfulness check."""
        opt_new_year = SAMPLE_OPTIMIZED_CLEAN_RESUME + "\nWorked at Acme Corp from 2014 to 2016"
        res = check_truthfulness(SAMPLE_ORIGINAL_RESUME, opt_new_year)
        assert res["passed"] is False
        assert any("New years not in original" in v for v in res["violations"])

    def test_severe_truncation_fails(self):
        """Optimized resume with < 30% length of original (> 50 words) fails."""
        orig_long = "Word " * 100 + "\nSoftware Engineer at TechCo"
        opt_tiny = "Software Engineer at TechCo"
        res = check_truthfulness(orig_long, opt_tiny)
        assert res["passed"] is False
        assert any("severely truncated" in v for v in res["violations"])

    def test_claim_ledger_invented_metrics_fail(self):
        """Adding ungrounded quantitative metric numbers fails via Source-Locked Claim Ledger."""
        opt_with_metrics = SAMPLE_OPTIMIZED_CLEAN_RESUME + "\n- Scaled revenue to $50M+ across 10B requests."
        res = check_truthfulness(SAMPLE_ORIGINAL_RESUME, opt_with_metrics)
        assert res["passed"] is False
        assert any("Claim Ledger" in v and "$50m+" in v.lower() for v in res["violations"])


# ---------------------------------------------------------------------------
# 3. Keyword Stuffing Guardrail Tests (keyword_stuffing.py)
# ---------------------------------------------------------------------------

class TestKeywordStuffingGuardrail:
    """Tests for keyword stuffing and density detection."""

    def test_normal_resume_text_passes(self):
        """Natural resume text passes without flags and with 0.0 density score."""
        normal_text = (
            "Senior Backend Engineer with 6 years of experience designing high-throughput "
            "distributed microservices. Led engineering teams through major database migrations "
            "and implemented automated CI/CD deployment pipelines. Proficient in Go, Python, "
            "Kubernetes, and relational database management systems."
        )
        res = check_keyword_stuffing(normal_text)
        assert res["passed"] is True
        assert res["density_score"] == 0.0
        assert res["flagged_keywords"] == []

    def test_empty_or_whitespace_text_passes(self):
        """Empty or blank text safely returns passed=True."""
        assert check_keyword_stuffing("")["passed"] is True
        assert check_keyword_stuffing("   \n\t  ")["passed"] is True
        assert check_keyword_stuffing(None)["passed"] is True

    def test_single_word_density_excess_fails(self):
        """A single word exceeding 15% of total words is flagged and fails."""
        # 20 words total, "python" appears 5 times (25% > 15%)
        text = "python python python python python engineer developer builder architect coder designer analyst tester leader manager staff"
        res = check_keyword_stuffing(text)
        assert res["passed"] is False
        assert any("'python' appears 5 times" in f for f in res["flagged_keywords"])

    def test_high_risk_keyword_excessive_repetition_fails(self):
        """Repeating a high-risk keyword 5+ times triggers unnatural frequency flag."""
        text = (
            "We built machine learning models with machine learning tools. "
            "Our machine learning pipeline uses machine learning algorithms "
            "for superior machine learning accuracy."
        )
        res = check_keyword_stuffing(text)
        assert res["passed"] is False
        assert any("High-risk keyword 'machine learning' repeated 5 times" in f for f in res["flagged_keywords"])

    def test_sentence_repetition_fails(self):
        """Repeating the same word (len > 3) 3+ times in a single sentence fails."""
        text = "We built scalable scalable scalable systems for enterprise operations."
        res = check_keyword_stuffing(text)
        assert res["passed"] is False
        assert any("'scalable' repeated 3 times in one sentence" in f for f in res["flagged_keywords"])

    def test_density_score_capped_at_one(self):
        """density_score is capped at 1.0."""
        ridiculously_stuffed = "python " * 200
        res = check_keyword_stuffing(ridiculously_stuffed)
        assert res["passed"] is False
        assert res["density_score"] <= 1.0


# ---------------------------------------------------------------------------
# 4. PII Detector Tests (pii_detector.py)
# ---------------------------------------------------------------------------

class TestPIIDetector:
    """Tests for PII identification and false-positive suppression."""

    def test_clean_text_without_pii_passes(self):
        """Clean resume text without sensitive PII passes."""
        clean = (
            "Alex Morgan\n"
            "Full Stack Developer\n"
            "Experienced in building web applications with Python, React, and PostgreSQL.\n"
            "Graduated from State University in 2022."
        )
        res = check_pii(clean)
        assert res["passed"] is True
        assert res["pii_found"] == []

    def test_detects_ssn(self):
        """Detects standard Social Security Numbers (dashed, spaced, and compact)."""
        samples = [
            "My SSN is 123-45-6789 on the document",
            "SSN 987 65 4321 for verification",
            "Reference ID: 555-12-8888",
        ]
        for s in samples:
            res = check_pii(s)
            assert res["passed"] is False
            assert any(item["type"] == "SSN" for item in res["pii_found"])

    def test_detects_phone_numbers(self):
        """Detects standard North American phone numbers."""
        samples = [
            "Call me at (415) 555-0132 for an interview",
            "Direct line: 415-555-0199",
            "Phone: +1 415 555 0188",
            "Mobile: 415.555.0177",
        ]
        for s in samples:
            res = check_pii(s)
            assert res["passed"] is False
            assert any(item["type"] == "Phone" for item in res["pii_found"])

    def test_numeric_candidate_id_not_classified_as_phone(self):
        """Unformatted 10-digit tokens like candidate IDs without phone context are not flagged as Phone."""
        non_phone_samples = [
            "Candidate ID: 1234567890",
            "Applicant reference 9876543210 submitted for review",
        ]
        for s in non_phone_samples:
            res = check_pii(s)
            assert not any(item["type"] == "Phone" for item in res["pii_found"])

        # Genuine unformatted phone with context still triggers detection
        phone_with_context = "Phone: 1234567890"
        res_phone = check_pii(phone_with_context)
        assert res_phone["passed"] is False
        assert any(item["type"] == "Phone" for item in res_phone["pii_found"])

    def test_detects_emails(self):
        """Detects email addresses."""
        samples = [
            "Contact me at alex.morgan@gmail.com",
            "Reach out via test-user_12@sub.domain.co",
        ]
        for s in samples:
            res = check_pii(s)
            assert res["passed"] is False
            assert any(item["type"] == "Email" for item in res["pii_found"])

    def test_detects_credit_cards(self):
        """Detects 16-digit credit card numbers."""
        text = "Payment card: 4111-2222-3333-4444"
        res = check_pii(text)
        assert res["passed"] is False
        assert any(item["type"] == "Credit Card" for item in res["pii_found"])

    def test_detects_passport_with_context(self):
        """Detects passport numbers when accompanied by passport context."""
        text = "My US passport number is A12345678."
        res = check_pii(text)
        assert res["passed"] is False
        assert any("Passport" in item["type"] for item in res["pii_found"])

    def test_detects_bank_account_with_context(self):
        """Detects bank account numbers when context keywords (bank/account/routing) are present."""
        text = "Bank account number 1234567890 for direct deposit."
        res = check_pii(text)
        assert res["passed"] is False
        assert any(item["type"] == "Bank Account (US)" for item in res["pii_found"])

    def test_detects_drivers_license_with_context(self):
        """Detects driver's license numbers with dl/license context."""
        text = "Driver's license number: D1234567"
        res = check_pii(text)
        assert res["passed"] is False
        assert any(item["type"] == "Driver's License" for item in res["pii_found"])

    def test_context_filter_suppresses_year_as_ssn(self):
        """Years (e.g. 2021, 1999) or years with 'year' in context are not falsely flagged as SSN."""
        text = "Graduated in 2021 and worked from year 2022 to 2024."
        res = check_pii(text)
        assert not any(item["type"] == "SSN" for item in res["pii_found"])

    def test_deduplication_of_matches(self):
        """Duplicate detections at the same position are deduplicated."""
        text = "SSN: 123-45-6789"
        res = check_pii(text)
        assert len(res["pii_found"]) == 1


# ---------------------------------------------------------------------------
# 5. ATS PDF Validator Tests (ats_pdf_validator.py)
# ---------------------------------------------------------------------------

class TestATSPDFValidator:
    """Tests for ATS parseability validation on PDF files."""

    def test_empty_or_too_short_bytes(self):
        """Empty or <10 bytes PDF is rejected as invalid."""
        for b in [b"", b"short", None]:
            res = ATSPDFValidator.validate_pdf_bytes(b)
            assert res["is_parseable"] is False
            assert res["score"] == 0
            assert "Invalid or empty PDF file" in res["issues"]

    def test_missing_magic_header(self):
        """Bytes lacking the %PDF header are rejected."""
        res = ATSPDFValidator.validate_pdf_bytes(b"INVALID_HEADER_CONTENT_BYTES")
        assert res["is_parseable"] is False
        assert res["score"] == 0
        assert "File missing %PDF magic header" in res["issues"]

    def test_low_stream_density_and_missing_fonts(self):
        """Valid header but missing font structures and low stream density lowers ATS score."""
        minimal_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        res = ATSPDFValidator.validate_pdf_bytes(minimal_pdf)
        assert res["score"] < 70
        assert res["is_parseable"] is False
        assert any("Low text stream density" in issue for issue in res["issues"])
        assert any("Unusual font structures" in issue for issue in res["issues"])

    def test_valid_parseable_pdf(self):
        """PDF containing standard fonts and selectable text streams achieves score 100."""
        import io
        from reportlab.pdfgen import canvas

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pageCompression=0)
        c.setFont("Helvetica", 12)
        c.drawString(100, 700, "Jane Doe")
        c.drawString(100, 680, "Software Engineer")
        c.drawString(100, 660, "Skills: Python, Go")
        c.drawString(100, 640, "Experience at TechCorp")
        c.drawString(100, 620, "Education: BS in CS")
        c.showPage()
        c.save()

        valid_pdf = buf.getvalue()
        res = ATSPDFValidator.validate_pdf_bytes(valid_pdf)
        assert res["is_parseable"] is True
        assert res["score"] == 100
        assert res["issues"] == []
        assert res["text_stream_objects_found"] >= 5
        assert res["recommendation"] == "PDF is ATS-friendly"


# ---------------------------------------------------------------------------
# 6. Entity Disambiguator Tests (entity_disambiguator.py)
# ---------------------------------------------------------------------------

class TestEntityDisambiguator:
    """Tests for homonym resolution and context-aware disambiguation."""

    def test_disambiguate_go_with_programming_context(self):
        """'Go' disambiguates to programming language when surrounded by tech keywords."""
        context = "Senior backend developer experienced in golang, concurrency, and goroutines."
        res = EntityDisambiguator.disambiguate_term("Go", context)
        assert res["canonical_entity"] == "Go (Programming Language)"
        assert res["confidence"] == 0.95
        assert "golang" in res["matched_context_words"]

    def test_disambiguate_go_general_fallback(self):
        """'Go' falls back to general term when programming keywords are absent."""
        context = "Ready to go on business trips and travel to conferences."
        res = EntityDisambiguator.disambiguate_term("Go", context)
        assert res["canonical_entity"] == "General Term"
        assert res["confidence"] == 0.50
        assert res["matched_context_words"] == []

    def test_disambiguate_ml_with_machine_learning_context(self):
        """'ML' disambiguates to Machine Learning when AI/ML keywords are present."""
        context = "Built deep learning model pipelines with PyTorch and Python."
        res = EntityDisambiguator.disambiguate_term("ML", context)
        assert res["canonical_entity"] == "Machine Learning"
        assert res["confidence"] == 0.95
        assert "pytorch" in res["matched_context_words"]

    def test_disambiguate_ml_ocaml_fallback(self):
        """'ML' falls back to OCaml / General when machine learning keywords are absent."""
        context = "Designed functional algorithms and recursive data types."
        res = EntityDisambiguator.disambiguate_term("ML", context)
        assert res["canonical_entity"] == "OCaml / General"
        assert res["confidence"] == 0.50

    def test_unambiguous_or_unknown_term(self):
        """Unambiguous terms pass through unchanged with 1.0 confidence."""
        res = EntityDisambiguator.disambiguate_term("PostgreSQL", "Relational database architect")
        assert res["canonical_entity"] == "PostgreSQL"
        assert res["confidence"] == 1.0
