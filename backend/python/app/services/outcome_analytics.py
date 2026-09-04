"""Outcome Learning Loop Analytics & Persistence (WP-09).

Computes match precision, artifact acceptance rate, and repeat workflow rate
with 95% Wilson score confidence intervals and sample size n. Never outputs
bare percentages for small samples.
"""
from __future__ import annotations

import math
import uuid
from typing import Any, Optional
from datetime import datetime, timezone

from app.services.db import get_pool

ALLOWED_EVENT_TYPES = frozenset({
    "saved",
    "rejected",
    "applied",
    "interviewing",
    "declined",
    "offer",
    "hired",
})

CONFIRMED_PROGRESS_EVENTS = frozenset({
    "applied",
    "interviewing",
    "offer",
    "hired",
})


def _iso(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else (str(value) if value else None)


def _serialize(row: Any) -> dict[str, Any]:
    item = dict(row)
    item["id"] = str(item["id"])
    item["user_id"] = str(item["user_id"])
    if item.get("application_run_id"):
        item["application_run_id"] = str(item["application_run_id"])
    item["created_at"] = _iso(item.get("created_at"))
    return item


def wilson_score_interval(
    successes: int,
    total: int,
    confidence: float = 0.95,
) -> dict[str, Any]:
    """Calculate the Wilson score interval for a binomial proportion.

    Guarantees mathematically sound confidence intervals, especially for small n.
    """
    k = max(0, int(successes))
    n = max(0, int(total))

    if n == 0:
        return {
            "point_estimate": 0.0,
            "point_percentage": 0,
            "n": 0,
            "successes": 0,
            "margin_of_error": 0.0,
            "margin_percentage": 0,
            "lower": 0.0,
            "upper": 0.0,
            "display": "0% (n=0, ±0%)",
        }

    # Constrain k to n
    k = min(k, n)
    p_hat = k / n

    # Critical value z for given confidence level
    # For 0.95 -> 1.95996
    if abs(confidence - 0.95) < 0.01:
        z = 1.959963984540054
    elif abs(confidence - 0.90) < 0.01:
        z = 1.6448536269514722
    elif abs(confidence - 0.99) < 0.01:
        z = 2.5758293035489004
    else:
        # Inverse error function approximation for standard normal quantile
        z = math.sqrt(2.0) * _erfinv(confidence)

    z2 = z * z
    denom = 1.0 + (z2 / n)
    center = (p_hat + (z2 / (2.0 * n))) / denom

    radicand = (p_hat * (1.0 - p_hat) / n) + (z2 / (4.0 * n * n))
    half_width = (z * math.sqrt(max(0.0, radicand))) / denom

    lower = max(0.0, center - half_width)
    upper = min(1.0, center + half_width)

    # Use average margin of error for display
    margin = (upper - lower) / 2.0
    point_pct = int(round(p_hat * 100))
    margin_pct = int(round(margin * 100))

    return {
        "point_estimate": round(p_hat, 4),
        "point_percentage": point_pct,
        "n": n,
        "successes": k,
        "margin_of_error": round(margin, 4),
        "margin_percentage": margin_pct,
        "lower": round(lower, 4),
        "upper": round(upper, 4),
        "display": f"{point_pct}% (n={n}, ±{margin_pct}%)",
    }


def _erfinv(y: float) -> float:
    """Winitzki approximation of inverse error function."""
    a = 0.147
    sgn = 1.0 if y > 0 else -1.0
    abs_y = abs(y)
    if abs_y >= 1.0:
        return sgn * 3.5  # clamp
    ln1 = math.log(1.0 - abs_y * abs_y)
    part1 = 2.0 / (math.pi * a) + ln1 / 2.0
    rad = part1 * part1 - (ln1 / a)
    return sgn * math.sqrt(max(0.0, math.sqrt(max(0.0, rad)) - part1))


def compute_outcome_metrics(
    events: list[dict[str, Any]],
    total_recommendations: Optional[int] = None,
    total_artifacts: Optional[int] = None,
    accepted_artifacts: Optional[int] = None,
) -> dict[str, Any]:
    """Compute learning loop metrics with Wilson score confidence intervals.

    Never outputs bare percentages for small samples.
    """
    total_events = len(events)
    candidate_confirmed_events = [
        e for e in events if e.get("is_candidate_confirmed") is True
    ]
    candidate_confirmed_count = len(candidate_confirmed_events)
    externally_verified_count = sum(
        1 for e in events if e.get("is_externally_verified") is True
    )

    # Match Precision: candidate_confirmed / total_recommended
    # If total_recommendations is not explicitly passed, use total_events as the denominator (min 0)
    effective_recommended = total_recommendations if total_recommendations is not None else total_events
    confirmed_matches = sum(
        1 for e in candidate_confirmed_events if e.get("event_type") in CONFIRMED_PROGRESS_EVENTS
    )
    # If no progress-specific events, count any candidate-confirmed event
    if confirmed_matches == 0 and candidate_confirmed_count > 0 and total_events > 0:
        confirmed_matches = candidate_confirmed_count

    match_precision = wilson_score_interval(confirmed_matches, effective_recommended)

    # Artifact Acceptance Rate: accepted_artifacts / total_artifacts
    # Fallback to confirmed events count / total events if not passed
    eff_artifacts = total_artifacts if total_artifacts is not None else total_events
    eff_accepted = accepted_artifacts if accepted_artifacts is not None else candidate_confirmed_count
    artifact_acceptance = wilson_score_interval(eff_accepted, eff_artifacts)

    # Repeat Workflow Rate:
    # Measures proportion of distinct entities (e.g. application runs) with >= 2 events.
    # Only group by application_run_id; skip events where it is absent to avoid inflating
    # the denominator with synthetic per-event keys.
    run_groups: dict[str, int] = {}
    for e in events:
        run_id = e.get("application_run_id")
        if run_id:
            run_id = str(run_id)
            run_groups[run_id] = run_groups.get(run_id, 0) + 1

    total_runs = len(run_groups)
    repeat_runs = sum(1 for count in run_groups.values() if count > 1)
    repeat_workflow_rate = wilson_score_interval(repeat_runs, total_runs)


    # Distribution of event types
    event_counts: dict[str, int] = {}
    for et in ALLOWED_EVENT_TYPES:
        event_counts[et] = 0
    for e in events:
        et = e.get("event_type")
        if et in event_counts:
            event_counts[et] += 1

    return {
        "match_precision": match_precision,
        "artifact_acceptance_rate": artifact_acceptance,
        "repeat_workflow_rate": repeat_workflow_rate,
        "sample_size": total_events,
        "candidate_confirmed_count": candidate_confirmed_count,
        "externally_verified_count": externally_verified_count,
        "event_type_distribution": event_counts,
    }


async def record_outcome_event(
    user_id: str,
    payload: dict[str, Any],
    is_service_role: bool = False,
) -> dict[str, Any] | None:
    """Record a verified or candidate-confirmed outcome event."""
    if not user_id:
        return None
    try:
        owner_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        return None

    event_type = str(payload.get("event_type") or "").strip().lower()
    if event_type not in ALLOWED_EVENT_TYPES:
        return None

    # Enforce that client tokens cannot set is_externally_verified = True
    is_externally_verified = False
    if is_service_role and payload.get("is_externally_verified") is True:
        is_externally_verified = True

    is_candidate_confirmed = bool(payload.get("is_candidate_confirmed", True))
    notes = str(payload.get("notes") or "").strip() or None

    app_run_id_raw = payload.get("application_run_id")
    app_run_uuid = None
    if app_run_id_raw:
        try:
            app_run_uuid = uuid.UUID(str(app_run_id_raw).strip())
        except (ValueError, TypeError):
            app_run_uuid = None

    pool = await get_pool()
    if not pool:
        return None

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO public.outcome_events
                    (user_id, application_run_id, event_type,
                     is_candidate_confirmed, is_externally_verified, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, user_id, application_run_id, event_type,
                          is_candidate_confirmed, is_externally_verified, notes, created_at
                """,
                owner_uuid,
                app_run_uuid,
                event_type,
                is_candidate_confirmed,
                is_externally_verified,
                notes,
            )
        return _serialize(row) if row else None
    except Exception:
        return None


async def list_outcome_events(
    user_id: str,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """List outcome events for the given user in descending order."""
    if not user_id:
        return []
    try:
        owner_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        return []

    pool = await get_pool()
    if not pool:
        return []

    bounded_limit = min(max(int(limit), 1), 200)
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, user_id, application_run_id, event_type,
                       is_candidate_confirmed, is_externally_verified, notes, created_at
                FROM public.outcome_events
                WHERE user_id = $1::uuid
                ORDER BY created_at DESC
                LIMIT $2
                """,
                owner_uuid,
                bounded_limit,
            )
        return [_serialize(row) for row in rows]
    except Exception:
        return []


async def get_outcome_analytics(user_id: str) -> dict[str, Any]:
    """Retrieve outcome events and compute learning loop metrics."""
    events = await list_outcome_events(user_id, limit=200)
    return compute_outcome_metrics(events)
