"""Unit tests for OntologyGuard company/skill claim validation."""

from app.guardrails.ontology_guard import OntologyGuard


def test_verified_company_and_skill_claim_is_valid():
    result = OntologyGuard.validate_claim(
        "Developed Python at Google", ["python"], ["Google"]
    )
    assert result["is_valid"] is True
    assert result["status"] == "APPROVED"
    assert result["unverified_mentions"] == []


def test_multi_word_verified_company_is_not_flagged():
    result = OntologyGuard.validate_claim(
        "Engineered solutions at Target Corp", ["python"], ["Target Corp"]
    )
    assert result["is_valid"] is True
    assert result["status"] == "APPROVED"
    assert result["unverified_mentions"] == []


def test_unverified_company_flagged_case_insensitive():
    for variant in ("Microsoft", "MICROSOFT", "microsoft"):
        result = OntologyGuard.validate_claim(
            f"Worked at {variant}", ["python"], ["Google"]
        )
        assert result["is_valid"] is False
        assert result["status"] == "FLAGGED_UNVERIFIED"
        assert result["unverified_mentions"] == ["microsoft"]


def test_work_verb_preposition_company_flagged():
    for claim, company in (
        ("Worked for Microsoft", "microsoft"),
        ("Employed by Acme", "acme"),
        ("Interned at Googleplex", "googleplex"),
    ):
        result = OntologyGuard.validate_claim(claim, ["python"], ["Google"])
        assert result["is_valid"] is False
        assert result["status"] == "FLAGGED_UNVERIFIED"
        assert company in result["unverified_mentions"]


def test_prose_at_is_not_a_company_slot():
    result = OntologyGuard.validate_claim(
        "Managed a team at scale", ["python"], ["Google"]
    )
    assert result["is_valid"] is True
    assert result["status"] == "APPROVED"
    assert result["unverified_mentions"] == []


def test_verified_skill_after_at_is_not_a_company():
    result = OntologyGuard.validate_claim(
        "Adept at Python", ["python"], ["Google"]
    )
    assert result["is_valid"] is True
    assert result["status"] == "APPROVED"
    assert result["unverified_mentions"] == []


def test_mention_containing_verified_company_is_unverified():
    result = OntologyGuard.validate_claim(
        "worked at googleplex", ["python"], ["google"]
    )
    assert result["is_valid"] is False
    assert result["status"] == "FLAGGED_UNVERIFIED"
    assert result["unverified_mentions"] == ["googleplex"]


def test_skill_validation_still_works():
    result = OntologyGuard.validate_claim(
        "Used Docker for CI", ["python"], ["Google"]
    )
    assert result["is_valid"] is False
    assert result["status"] == "FLAGGED_UNVERIFIED"
    assert result["unverified_mentions"] == ["docker"]


def test_unverified_skill_and_company_both_flagged():
    result = OntologyGuard.validate_claim(
        "Used Docker at Microsoft", ["python"], ["Google"]
    )
    assert result["is_valid"] is False
    assert "docker" in result["unverified_mentions"]
    assert "microsoft" in result["unverified_mentions"]


def test_claim_without_company_or_keyword_mention_is_valid():
    result = OntologyGuard.validate_claim("Built scalable services", [], [])
    assert result["is_valid"] is True
    assert result["status"] == "APPROVED"
    assert result["unverified_mentions"] == []
