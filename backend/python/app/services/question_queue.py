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
import hashlib
from typing import Any, Iterable

from app.services.db import get_pool

logger = logging.getLogger(__name__)


class QuestionQueueUnavailable(RuntimeError):
    """Raised when the queue cannot safely read or persist a human handoff."""

# Fields that must ALWAYS be routed to the human, even when a plausible value
# exists in the profile — the answer is legal, monetary, or self-identifying.
_ALWAYS_ASK: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"\bsponsor(?:ship|ed)?\b",
        r"\b(?:work )?authoriz(?:ed|ation)\b",
        r"\bauthoris(?:ed|ation)\b",
        r"\bright to work\b",
        r"\bvisa\b",
        r"\b(?:h-?1b|opt|cpt|tn status|e-?3|l-?1|stem opt|immigration status)\b",
        r"\bcitizen(?:ship)?\b",
        r"\bsecurity clearance\b",
        r"\b(?:desired|expected|current)?\s*(?:salary|compensation|pay|base pay)\b",
        r"\b(?:bonus|equity|stock options?|hourly rate|day rate|target cash)\b",
        r"\bnotice period\b",
        r"\bwilling to relocate\b",
        r"\bcriminal\b|\bfelony\b|\bconvict(?:ed|ion)\b",
        r"\b(?:drug (?:test|screen)|non-?compete|conflict of interest|nda)\b",
        r"\bdisabilit(?:y|ies)\b",
        r"\bveteran\b",
        r"\bgender\b|\brace\b|\bethnicit(?:y|ies)\b",
        r"\b(?:sex|hispanic|latino|sexual orientation|lgbtq\+?)\b",
        r"\b(?:password|passcode|2fa|mfa|otp|pin|security code|captcha|recaptcha|turnstile|auth code)\b",
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
    # Normalize snake_case or dash-case (e.g. expected_salary, is_veteran) into words
    normalized = label.replace("_", " ").replace("-", " ")
    return any(p.search(normalized) for p in _ALWAYS_ASK)


def normalize_field_key(label: str) -> str:
    """Map a portal label to a stable non-secret key for the current question."""
    normalized = re.sub(r"[^a-z0-9]+", "_", (label or "").lower()).strip("_")
    aliases = (
        ("sponsor", "sponsorship"),
        ("visa", "sponsorship"),
        ("authoriz", "work_authorization"),
        ("salary", "salary"),
        ("compensation", "salary"),
        ("notice_period", "notice_period"),
        ("gender", "eeo_gender"),
        ("race", "eeo_race"),
        ("ethnic", "eeo_race"),
        ("veteran", "eeo_veteran"),
        ("disabil", "eeo_disability"),
    )
    for token, key in aliases:
        if token in normalized:
            return key
    return normalized or "unlabeled_sensitive_field"


def sensitivity_class(label: str) -> str:
    lowered = (label or "").lower()
    if any(token in lowered for token in ("salary", "compensation", "pay", "notice")):
        return "compensation"
    if any(token in lowered for token in ("gender", "race", "ethnic", "veteran", "disabil")):
        return "eeo"
    return "legal"


def answer_hash(answer: str | None) -> str | None:
    if not answer:
        return None
    return hashlib.sha256(answer.strip().encode("utf-8")).hexdigest()


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
                "field_key": normalize_field_key(label),
                "sensitivity_class": sensitivity_class(label),
                "field_type": "choice" if role in _CHOICE_ROLES else "text",
                "options": node.get("options") or [],
                "redacted_context": f"Human answer required for {sensitivity_class(label)} field.",
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
    application_id: str | None = None,
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
        raise QuestionQueueUnavailable("question queue storage is unavailable")
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
                      AND normalized_field_key = $2
                      AND status = 'pending'
                      AND run_id IS NOT DISTINCT FROM $3
                      AND application_id IS NOT DISTINCT FROM $4
                    LIMIT 1
                    """,
                    user_id,
                    q.get("field_key") or normalize_field_key(q["field_label"]),
                    run_id,
                    application_id,
                )
                if exists:
                    continue
                await conn.execute(
                    """
                    INSERT INTO agent_questions
                        (user_id, run_id, job_title, company, field_label, normalized_field_key,
                         field_type, options, status, handoff_state, sensitivity_class,
                         required_for_state, redacted_context, application_id, provenance_type)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'pending', 'needs_human',
                            $9, 'needs_sensitive_answer', $10, $11, 'unset')
                    """,
                    user_id,
                    run_id,
                    job_title,
                    company,
                    q["field_label"],
                    q.get("field_key") or normalize_field_key(q["field_label"]),
                    q.get("field_type") or "text",
                    json.dumps(q.get("options") or []),
                    q.get("sensitivity_class") or sensitivity_class(q["field_label"]),
                    q.get("redacted_context") or "Human answer required.",
                    application_id,
                )
                written += 1
    except Exception as exc:  # noqa: BLE001 — fail closed instead of dropping a handoff
        logger.warning("question_queue: enqueue failed (%s)", exc)
        raise QuestionQueueUnavailable("question queue persistence failed") from exc
    return written


async def list_questions_for_user(
    user_id: str | None,
    *,
    status: str | None = None,
) -> list[dict[str, Any]]:
    """List question rows owned by one user for self-hosted clients."""
    if not user_id:
        return []
    pool = await get_pool()
    if not pool:
        raise QuestionQueueUnavailable("question queue storage is unavailable")
    allowed_statuses = {"pending", "answered", "skipped"}
    if status is not None and status not in allowed_statuses:
        raise ValueError("invalid question status")
    clauses = ["user_id = $1"]
    args: list[Any] = [user_id]
    if status:
        clauses.append("status = $2")
        args.append(status)
    query = f"""
        SELECT id, run_id, job_title, company, field_label, normalized_field_key,
               field_type, options, answer, status, handoff_state, sensitivity_class,
               required_for_state, redacted_context, application_id, provenance_type,
               answer_hash, answer_version, expires_at, created_at, answered_at, updated_at
        FROM agent_questions
        WHERE {' AND '.join(clauses)}
        ORDER BY created_at DESC
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
        result = []
        for row in rows:
            item = dict(row)
            options = item.get("options")
            if isinstance(options, str):
                item["options"] = json.loads(options)
            result.append(item)
        return result
    except Exception as exc:  # noqa: BLE001
        logger.warning("question_queue: list failed (%s)", exc)
        raise QuestionQueueUnavailable("question queue read failed") from exc


async def answer_question_for_user(
    question_id: str,
    user_id: str | None,
    *,
    answer: str | None,
    status: str,
) -> dict[str, Any] | None:
    """Resolve one question only when it belongs to the authenticated user."""
    if not question_id or not user_id or status not in {"answered", "skipped"}:
        raise ValueError("invalid question update")
    cleaned_answer = (answer or "").strip() or None
    if status == "answered" and not cleaned_answer:
        raise ValueError("an answer is required when status is answered")
    pool = await get_pool()
    if not pool:
        raise QuestionQueueUnavailable("question queue storage is unavailable")
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE agent_questions
                    SET answer = $1,
                    answer_hash = $5,
                    provenance_type = CASE WHEN $2 = 'answered' THEN 'user_entered' ELSE 'unset' END,
                    status = $2,
                    handoff_state = CASE WHEN $2 = 'answered' THEN 'resolved' ELSE 'skipped' END,
                    answered_at = now(),
                    updated_at = now()
                WHERE id = $3 AND user_id = $4
                RETURNING id, run_id, job_title, company, field_label, normalized_field_key,
                          field_type, options, answer, status, handoff_state, sensitivity_class,
                          required_for_state, redacted_context, application_id, provenance_type,
                          answer_hash, answer_version, expires_at, created_at, answered_at, updated_at
                """,
                cleaned_answer,
                status,
                question_id,
                user_id,
                answer_hash(cleaned_answer),
            )
        if not row:
            return None
        item = dict(row)
        options = item.get("options")
        if isinstance(options, str):
            item["options"] = json.loads(options)
        return item
    except Exception as exc:  # noqa: BLE001
        logger.warning("question_queue: answer update failed (%s)", exc)
        raise QuestionQueueUnavailable("question queue update failed") from exc


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
