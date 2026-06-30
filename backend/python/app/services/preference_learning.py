"""Daily preference-learning job: turn feedback signals into a weighted profile.

Reads ``user_job_feedback`` (liked / applied / disliked / skipped) and computes
a preference profile:

- preferred roles + companies (from the user_preference_summary matview)
- TF-IDF-weighted skill preferences, mined from the ``metadata`` JSONB of
  liked/applied feedback rows (each row may carry a ``skills`` list).

The materialized view ``user_preference_summary`` is the persisted profile
store (no separate ``user_preference_profiles`` table — ponytail: YAGNI, the
matview already aggregates counts + titles + companies). This job refreshes it
then layers TF-IDF skill weights on top, in-memory, for the response.

TF-IDF scheme (cheap, no deps):
- TF(skill)  = count of liked/applied rows mentioning the skill
- IDF(skill) = log(total_rows / rows mentioning the skill across ALL feedback)
- weight     = TF * IDF, normalized to the max

DIP: depends on :func:`get_pool`, never a concrete client. Never raises —
returns an empty profile on any failure so the Celery task + route stay green.
"""
from __future__ import annotations

import json
import logging
import math
import uuid
from collections import Counter
from typing import Any

from app.services.db import get_pool

logger = logging.getLogger(__name__)

POSITIVE_TYPES = ("liked", "applied")
ALL_TYPES = ("liked", "applied", "disliked", "skipped", "saved")
MAX_SKILLS_IN_PROFILE = 20
MIN_IDF_DENOMINATOR = 1  # avoid div-by-zero when only one row exists


async def _refresh_summary_view() -> bool:
    """Refresh user_preference_summary matview concurrently. False if DB off."""
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute("SELECT refresh_user_preference_summary()")
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("preference_learning: matview refresh failed (%s)", exc)
        return False


def _extract_skills(metadata: Any) -> list[str]:
    """Pull a normalized lowercased skill list from a feedback row's metadata."""
    if not metadata:
        return []
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except Exception:  # noqa: BLE001
            return []
    if not isinstance(metadata, dict):
        return []
    skills = metadata.get("skills") or metadata.get("skill_tags") or []
    if not isinstance(skills, list):
        return []
    return [str(s).strip().lower() for s in skills if str(s).strip()]


def _compute_tfidf(rows: list[dict]) -> dict[str, float]:
    """Return {skill: normalized_weight} via TF-IDF over liked/applied rows.

    Pure function (SRP): no I/O. IDF denominator uses ALL feedback rows so a
    skill appearing in every row (uninformative) gets weight ~0.
    """
    if not rows:
        return {}

    positive_rows = [r for r in rows if r.get("feedback_type") in POSITIVE_TYPES]
    if not positive_rows:
        return {}

    total_rows = max(len(rows), MIN_IDF_DENOMINATOR)
    doc_freq: Counter[str] = Counter()
    for r in rows:
        for skill in set(_extract_skills(r.get("metadata"))):
            doc_freq[skill] += 1

    tf: Counter[str] = Counter()
    for r in positive_rows:
        for skill in _extract_skills(r.get("metadata")):
            tf[skill] += 1

    weights: dict[str, float] = {}
    for skill, tf_val in tf.items():
        idf = math.log(total_rows / max(doc_freq.get(skill, MIN_IDF_DENOMINATOR), MIN_IDF_DENOMINATOR))
        if idf <= 0:
            continue
        weights[skill] = tf_val * idf

    if not weights:
        return {}
    max_w = max(weights.values())
    if max_w <= 0:
        return {}
    return {s: round(w / max_w, 4) for s, w in weights.items()}


async def run_preference_learning(user_id: str) -> dict:
    """Compute + persist (via matview refresh) a user's preference profile.

    Returns ``{user_id, preferred_titles, preferred_companies, counts,
    skill_weights}``. Empty on any failure / no feedback. Never raises.
    """
    if not user_id:
        return {"user_id": "", "preferred_titles": [], "preferred_companies": [], "counts": {}, "skill_weights": {}}

    await _refresh_summary_view()
    pool = await get_pool()
    if not pool:
        return {"user_id": user_id, "preferred_titles": [], "preferred_companies": [], "counts": {}, "skill_weights": {}}

    try:
        async with pool.acquire() as conn:
            summary = await conn.fetchrow(
                "SELECT preferred_titles, preferred_companies, liked_count, applied_count, skipped_count "
                "FROM user_preference_summary WHERE user_id = $1::uuid",
                uuid.UUID(user_id),
            )
            rows = await conn.fetch(
                "SELECT feedback_type, metadata FROM user_job_feedback WHERE user_id = $1::uuid",
                uuid.UUID(user_id),
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("preference_learning: profile read failed (%s)", exc)
        return {"user_id": user_id, "preferred_titles": [], "preferred_companies": [], "counts": {}, "skill_weights": {}}

    titles = [t for t in (summary.get("preferred_titles") if summary else []) if t]
    companies = [c for c in (summary.get("preferred_companies") if summary else []) if c]
    counts = {
        "liked": (summary.get("liked_count") if summary else 0) or 0,
        "applied": (summary.get("applied_count") if summary else 0) or 0,
        "skipped": (summary.get("skipped_count") if summary else 0) or 0,
    }

    row_dicts = [dict(r) for r in rows]
    skill_weights = _compute_tfidf(row_dicts)
    top_skills = sorted(skill_weights.items(), key=lambda kv: kv[1], reverse=True)[:MAX_SKILLS_IN_PROFILE]

    return {
        "user_id": user_id,
        "preferred_titles": titles[:MAX_SKILLS_IN_PROFILE],
        "preferred_companies": companies[:MAX_SKILLS_IN_PROFILE],
        "counts": counts,
        "skill_weights": dict(top_skills),
    }