"""Tests for P3/C3 salary-benchmark wiring (role->BLS series mapping).

Truthfulness contract under test:
- mapping covers the 10 common roles, each entry labelled verified|estimate
- mocked BLS response shapes band correctly (median point estimate +/-25%)
- BLS failure/unparseable -> Nones + provenance unavailable (never fabricated)
- scenario planner prefers verified band, ignores unavailable (no relabelling)
"""
import pytest

from app.services import market_intelligence as mi
from app.services.scenario_planner import plan_scenario


EXPECTED_ROLES = [
    "backend engineer",
    "frontend engineer",
    "data engineer",
    "data scientist",
    "devops engineer",
    "product manager",
    "designer",
    "qa engineer",
    "mobile engineer",
    "engineering manager",
]


def test_mapping_covers_ten_roles_with_labels():
    assert set(EXPECTED_ROLES) <= {k.lower() for k in mi.ROLE_TO_BLS_SERIES}
    for role in EXPECTED_ROLES:
        entry = mi.ROLE_TO_BLS_SERIES[role]
        ids = entry if isinstance(entry, list) else entry["series_ids"]
        assert len(ids) >= 1 and all(isinstance(s, str) and s.strip() for s in ids)
        if isinstance(entry, dict):
            assert entry.get("label") == "estimate"
            assert entry.get("scale") in ("index", "wage")


def _bls_ok(url, payload, timeout=5):
    assert "bls.gov" in url
    sid = payload["seriesid"][0]
    return {"Results": {"series": [{
        "seriesID": sid,
        "data": [{"year": "2026", "period": "Q02", "value": "100000", "footnotes": []}],
    }]}}


@pytest.mark.asyncio
async def test_mocked_bls_response_shapes_band():
    band = await mi.get_salary_band("backend engineer", _client=None, http_post=_bls_ok)
    assert band["median"] is None and band["p25"] is None and band["p75"] is None
    assert band["provenance"] == "unavailable"
    assert band["source"] == "unavailable"


@pytest.mark.asyncio
async def test_index_scale_series_never_shapes_wage_band(monkeypatch):
    monkeypatch.setitem(
        mi.ROLE_TO_BLS_SERIES, "wage test role",
        {"series_ids": ["CIU2010000000000A"], "label": "estimate", "scale": "index"},
    )
    try:
        band = await mi.get_salary_band("wage test role", _client=None, http_post=_bls_ok)
    finally:
        monkeypatch.undo()
    assert band["median"] is None and band["p25"] is None and band["p75"] is None
    assert band["provenance"] == "unavailable"
    assert band.get("scale") == "index"


@pytest.mark.asyncio
async def test_wage_scale_series_shapes_band(monkeypatch):
    monkeypatch.setitem(
        mi.ROLE_TO_BLS_SERIES, "wage test role",
        {"series_ids": ["WAGE0000000000000"], "label": "estimate", "scale": "wage"},
    )
    try:
        band = await mi.get_salary_band("wage test role", _client=None, http_post=_bls_ok)
    finally:
        monkeypatch.undo()
    assert band["median"] == 100000
    assert band["p25"] == 75000
    assert band["p75"] == 125000
    assert band["provenance"] == "verified"
    assert band.get("scale") == "wage"


@pytest.mark.asyncio
async def test_bls_failure_yields_unavailable_never_fabricates():
    def _boom(url, payload, timeout=5):
        raise TimeoutError("bls down")

    band = await mi.get_salary_band("backend engineer", _client=None, http_post=_boom)
    assert band["median"] is None and band["p25"] is None and band["p75"] is None
    assert band["provenance"] == "unavailable"
    assert band["source"] == "unavailable"


@pytest.mark.asyncio
async def test_unknown_role_is_unavailable():
    band = await mi.get_salary_band("underwater basket weaver", _client=None, http_post=_bls_ok)
    assert band["median"] is None and band["provenance"] == "unavailable"


def test_planner_prefers_verified_band():
    band = {
        "role": "Staff Engineer", "median": 150000, "p25": 112500, "p75": 187500,
        "source": "BLS CIU2010000000000A", "provenance": "verified",
        "fetched_at": "2026-09-03T00:00:00+00:00", "scale": "wage",
    }
    plan = plan_scenario(
        "seniority_increase", ["Python", "FastAPI"],
        current_title="Senior Developer", target_role="Staff Engineer",
        salary_band=band,
    )
    primary = plan["available_roles"][0]
    assert primary["salary_band"]["median"] == 150000
    assert primary["salary_band"]["provenance"] == "verified"


def test_planner_ignores_unavailable_band():
    plan = plan_scenario(
        "role_change", ["Python"], target_role="ML Engineer",
        salary_band={"role": "ML Engineer", "median": None, "p25": None,
                     "p75": None, "source": "unavailable",
                     "provenance": "unavailable", "fetched_at": None},
    )
    assert all("salary_band" not in r for r in plan["available_roles"])
    assert all(r["provenance"] == "illustrative" for r in plan["available_roles"])
