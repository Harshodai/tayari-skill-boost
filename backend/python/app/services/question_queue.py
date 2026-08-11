"""WS-05 — the human-answer queue.

An ATS form always contains fields no profile can answer safely: work
authorization, sponsorship, veteran/disability self-identification, salary
expectation, criminal history. Guessing any of them is either a lie on a legal
form or a silent disqualification.

So the agent does not guess. When it meets a field it cannot ground in the
user's stored profile, it enqueues the question here and stops filling it. The
user answers it in ``/questions``; the answer becomes part of the profile for
the next run.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Iterable

from app.services.db import get_pool

logger = logging.getLogger(__name__)

# Fields that must ALWAYS be routed to the human, even when a plausible value
# exists in the profile — the answer is legal, monetary, or self-identifying.
_ALWAYS_ASK: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"\bsponsor(?:ship|ed)?\b",
        r"\b(?:work )?authoriz(?:ed|ation)\b",
        r"\bright to work\b",
        r"\bvisa\b",
        r"\bcitizen(?:ship)?\b",
        r"\bsecurity clearance\b",
        r"\b(?:desired|expected|current)?\s*(?:salary|compensation|pay)\b",
        r"\bnotice period\b",
        r"\bwilling to relocate\b",
        r"\bcriminal\b|\bfelony\b|\bconvict(?:ed|ion)\b",
        r"\bdisabilit(?:y|ies)\b",
        r"\bveteran\b",
        r"\bgender\b|\brace\b|\bethnicit(?:y|ies)\b",
        r"\byears? of experience\b",
        r"\bwhy do you want\b|\bcover letter\b",
    )
)

# Rough type hint so the UI can render the right control.
_CHOICE_ROLES = {"combobox", "radio", "checkbox", "select"}


def is_sensitive_field(label: str) -> bool:
    """True when ``label`` names a field the agent must never answer itself."""
    if not label:
        return False
    return any(p.search(label) for p in _ALWAYS_ASK)


def classify_fields(
    nodes: Iterable[dict[str, Any]],
    *,
    filled_labels: Iterable[str] = (),
) -> list[dict[str, Any]]:
    """Return the questions a human must answer for this form.

    ``nodes`` are accessibility-snapshot entries (``role``/``name``).
    A field is queued when it is sensitive, or when it is an unmapped input the
    agent could not fill from the profile. Labels already filled are skipped.
    """
    already = {l.strip().lower() for l in filled_labels if l}
    seen: set[str] = set()
    questions: list[dict[str, Any]] = []
    for node in nodes:
        label = (node.get("name") or "").strip()
        role = (node.get("role") or "").lower()
        if not label or role == "button":
            continue
        key = label.lower()
        if key in already or key in seen:
            continue
        if not is_sensitive_field(label):
            continue
        seen.add(key)
        questions.append(
            {
                "field_label": label,
                "field_type": "choice" if role in _CHOICE_ROLES else "text",
                "options": node.get("options") or [],
            }
        )
    return questions


async def enqueue_questions(
    questions: list[dict[str, Any]],
    *,
    user_id: str | None,
    run_id: str | None = None,
    job_title: str | None = None,
    company: str | None = None,
) -> int:
    """Persist pending questions. Returns how many rows were written.

    Degrades to a no-op (0) without a DB pool or a user — an ownerless question
    is unanswerable under RLS, and losing it is better than blocking the run on
    a row nobody can see.
    """
    if not questions or not user_id:
        return 0
    pool = await get_pool()
    if not pool:
        logger.info("question_queue: no DB pool, %d question(s) dropped", len(questions))
        return 0
    written = 0
    try:
        async with pool.acquire() as conn:
            for q in questions:
                # Re-asking the same field for the same run just noises up the
                # inbox; one pending row per (user, run, label) is enough.
                exists = await conn.fetchval(
                    """
                    SELECT 1 FROM agent_questions
                    WHERE user_id = $1
                      AND field_label = $2
                      AND status = 'pending'
                      AND run_id IS NOT DISTINCT FROM $3
                    LIMIT 1
                    """,
                    user_id,
                    q["field_label"],
                    run_id,
                )
                if exists:
                    continue
                await conn.execute(
                    """
                    INSERT INTO agent_questions
                        (user_id, run_id, job_title, company, field_label, field_type, options, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending')
                    """,
                    user_id,
                    run_id,
                    job_title,
                    company,
                    q["field_label"],
                    q.get("field_type") or "text",
                    json.dumps(q.get("options") or []),
                )
                written += 1
    except Exception as exc:  # noqa: BLE001 — the queue must never break a run
        logger.warning("question_queue: enqueue failed (%s)", exc)
    return written


async def pending_answers(user_id: str | None) -> dict[str, str]:
    """Answered questions as ``{field_label_lower: answer}`` for reuse on the
    next run, so the user is asked each thing once, not once per application."""
    if not user_id:
        return {}
    pool = await get_pool()
    if not pool:
        return {}
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT field_label, answer FROM agent_questions
                WHERE user_id = $1 AND status = 'answered' AND answer IS NOT NULL
                ORDER BY answered_at DESC
                """,
                user_id,
            )
        answers: dict[str, str] = {}
        for row in rows:
            answers.setdefault(row["field_label"].strip().lower(), row["answer"])
        return answers
    except Exception as exc:  # noqa: BLE001
        logger.warning("question_queue: answer lookup failed (%s)", exc)
        return {}
