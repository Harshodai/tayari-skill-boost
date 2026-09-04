"""C4 separate critic agent for the optimizer loop (RED-first)."""
from unittest import mock

import pytest

from app.services.resume_critic import audit_draft
from app.schemas import OptimizedResumePayloadSchema


MASTER = (
    "Software Engineer at Acme Corp (2020-2023). "
    "Raised revenue 10% by rebuilding the billing pipeline. "
    "B.S. Computer Science, Example University. "
    "Python, Postgres, Docker."
)


def _grounded_draft():
    return (
        "Software Engineer at Acme Corp (2020-2023). "
        "Raised revenue 10% by rebuilding the billing pipeline. "
        "B.S. Computer Science. Python, Postgres, Docker."
    )


def test_grounded_draft_passes():
    out = audit_draft(_grounded_draft(), MASTER)
    assert out["verdict"] == "pass"
    assert out["grounding_ratio"] == pytest.approx(1.0)
    assert out["invented_metrics"] == []
    assert out["reasons"] == []


def test_invented_metric_fails():
    draft = (
        "Software Engineer at Acme Corp (2020-2023). "
        "Raised revenue 300% by rebuilding the billing pipeline. "
        "B.S. Computer Science. Python, Postgres, Docker."
    )
    out = audit_draft(draft, MASTER)
    assert out["verdict"] == "fail"
    assert out["grounding_ratio"] < 0.95
    assert any("300" in m for m in out["invented_metrics"])
    assert out["reasons"]


def test_invented_employer_fails():
    draft = (
        "Software Engineer at Globex (2020-2023). "
        "Raised revenue 10% by rebuilding the billing pipeline. "
        "B.S. Computer Science."
    )
    out = audit_draft(draft, MASTER)
    assert out["verdict"] == "fail"
    assert out["reasons"]


def test_empty_draft_fails():
    out = audit_draft("", MASTER)
    assert out["verdict"] == "fail"
    assert out["grounding_ratio"] == pytest.approx(0.0)
    assert out["reasons"]


def test_dropped_employers_is_advisory_only():
    master = "Software Engineer at Acme Corp (2020-2023). Raised revenue 10%. B.S. Computer Science."
    draft = "Software Engineer (2020-2023). Raised revenue 10%. B.S. Computer Science."
    out = audit_draft(draft, master)
    assert "acme corp" in out["dropped_employers"]
    assert out["verdict"] == "pass"
    assert any("dropped employer" in r for r in out["reasons"])


def _payload(text):
    return OptimizedResumePayloadSchema(
        changes=["c"], keywords_added=[], estimated_score=50, optimized_text=text,
    )


@pytest.mark.asyncio
async def test_optimizer_refines_invented_metric_draft():
    from app.services.optimizer import optimize_with_reflection

    master = MASTER + " " + "Keyword-rich backend experience with Go and APIs. " * 4
    invented = (
        "Software Engineer at Acme Corp (2020-2023). "
        "Raised revenue 300% by rebuilding the billing pipeline with Go APIs. "
        "B.S. Computer Science. " + "Backend Go APIs experience. " * 10
    )
    grounded = (
        "Software Engineer at Acme Corp (2020-2023). "
        "Raised revenue 10% by rebuilding the billing pipeline with Go APIs. "
        "B.S. Computer Science. " + "Backend Go APIs experience. " * 10
    )
    assert audit_draft(invented, master)["verdict"] == "fail"
    assert audit_draft(grounded, master)["verdict"] == "pass"

    with mock.patch("app.services.optimizer.LongContextClient") as MockClient, mock.patch(
        "app.services.optimizer.semantic_ats_score",
        return_value={"score": 97, "checks": [], "missing_keywords": []},
    ), mock.patch(
        "app.services.optimizer.validate_master_alignment",
        return_value={"is_aligned": True, "violations": [], "confidence_score": 1.0},
    ):
        inst = MockClient.return_value
        inst.condense = mock.AsyncMock(side_effect=lambda t, **_: t)
        inst.map_reduce_json = mock.AsyncMock(
            side_effect=[_payload(invented), _payload(grounded)]
        )
        inst.map_reduce = mock.AsyncMock(side_effect=Exception("skip humanize"))
        result = await optimize_with_reflection(
            resume_text=master,
            job_description="Backend role requiring Go and APIs.",
        )
    assert result["refinement_passes"] == 2
    final = audit_draft(result["optimized_text"], master)
    assert final["verdict"] == "pass"
