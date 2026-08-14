"""Persistent user-owned candidate answer snapshots.

This module is deliberately separate from the matcher: matching may consume a
snapshot, but it must never invent one or treat a global compatibility object as
user data.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from app.services.db import get_pool


SENSITIVE_FIELDS = {
    "work_authorization",
    "requires_sponsorship",
    "sponsorship_answer",
    "target_salary_min",
    "target_salary_max",
    "salary_answer",
    "notice_period_days",
    "notice_period_answer",
    "relocation_willing",
    "years_experience",
    "gender",
    "race_ethnicity",
    "veteran_status",
    "disability_status",
}

FIELD_SENSITIVITY = {
    "work_authorization": "legal",
    "requires_sponsorship": "legal",
    "sponsorship_answer": "legal",
    "target_salary_min": "compensation",
    "target_salary_max": "compensation",
    "salary_answer": "compensation",
    "notice_period_days": "compensation",
    "notice_period_answer": "compensation",
    "relocation_willing": "identity",
    "years_experience": "identity",
    "gender": "eeo",
    "race_ethnicity": "eeo",
    "veteran_status": "eeo",
    "disability_status": "eeo",
}


class CandidateAnswerSnapshot(BaseModel):
    user_id: str
    version: int | None = None
    application_id: str | None = None
    answers: dict[str, Any] = Field(default_factory=dict)
    records: list[dict[str, Any]] = Field(default_factory=list)
    unresolved_sensitive_fields: list[str] = Field(default_factory=list)
    storage_available: bool = True


class AnswerBankStoreUnavailable(RuntimeError):
    """Raised when answer storage cannot be consulted safely."""


def _require_user(user_id: str) -> None:
    if not user_id or user_id == "default_user":
        raise ValueError("authenticated user_id is required for candidate answers")


def _hash_value(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _coerce_value(field_key: str, value: str | None) -> Any:
    if value is None:
        return None
    if field_key in {"requires_sponsorship", "relocation_willing"}:
        normalized = value.strip().lower()
        if normalized in {"true", "yes", "1"}:
            return True
        if normalized in {"false", "no", "0"}:
            return False
    if field_key in {"target_salary_min", "target_salary_max", "notice_period_days", "years_experience"}:
        try:
            return int(value)
        except (TypeError, ValueError):
            return value
    return value


async def load_candidate_answer_snapshot(
    user_id: str,
    *,
    application_id: str | None = None,
) -> CandidateAnswerSnapshot:
    """Load the latest owned snapshot and fail closed when storage is unavailable."""
    _require_user(user_id)
    pool = await get_pool()
    if not pool:
        raise AnswerBankStoreUnavailable("candidate answer storage is unavailable")
    try:
        async with pool.acquire() as conn:
            version_row = await conn.fetchrow(
                """
                SELECT id, version, application_id, confirmed_at, expires_at
                FROM candidate_answer_versions
                WHERE user_id = $1
                ORDER BY version DESC
                LIMIT 1
                """,
                user_id,
            )
            if not version_row:
                return CandidateAnswerSnapshot(
                    user_id=user_id,
                    application_id=application_id,
                    unresolved_sensitive_fields=sorted(SENSITIVE_FIELDS),
                )
            rows = await conn.fetch(
                """
                SELECT field_key, value, sensitivity_class, provenance_type,
                       provenance_ref, answer_hash, confirmed_for_application,
                       expires_at
                FROM candidate_answers
                WHERE user_id = $1 AND version_id = $2
                ORDER BY field_key
                """,
                user_id,
                version_row["id"],
            )
        version_application = version_row["application_id"]
        expired = bool(
            version_row["expires_at"]
            and version_row["expires_at"] <= datetime.now(timezone.utc)
        )
        records = [dict(row) for row in rows]
        context_matches = bool(application_id and version_application == application_id)
        answers: dict[str, Any] = {}
        for row in rows:
            field_key = row["field_key"]
            is_sensitive = field_key in SENSITIVE_FIELDS
            confirmed = bool(row["confirmed_for_application"])
            usable = bool(row["value"] is not None and not expired)
            if is_sensitive:
                usable = usable and confirmed and context_matches
            if usable:
                answers[field_key] = _coerce_value(field_key, row["value"])
        unresolved: list[str] = []
        for field in sorted(SENSITIVE_FIELDS):
            record = next((row for row in records if row["field_key"] == field), None)
            confirmed = bool(record and record["confirmed_for_application"])
            if not record or not confirmed or not context_matches or expired:
                unresolved.append(field)
        return CandidateAnswerSnapshot(
            user_id=user_id,
            version=version_row["version"],
            application_id=version_application,
            answers=answers,
            records=records,
            unresolved_sensitive_fields=unresolved,
        )
    except AnswerBankStoreUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001
        raise AnswerBankStoreUnavailable("candidate answer storage query failed") from exc


async def save_candidate_answer_snapshot(
    user_id: str,
    answers: dict[str, Any],
    *,
    application_id: str | None = None,
    confirm_sensitive: bool = False,
) -> CandidateAnswerSnapshot:
    """Create a new owned answer version; never persist secrets or unknown keys."""
    _require_user(user_id)
    pool = await get_pool()
    if not pool:
        raise AnswerBankStoreUnavailable("candidate answer storage is unavailable")
    allowed_fields = SENSITIVE_FIELDS | {"work_preference", "custom_qa"}
    cleaned: dict[str, Any] = {}
    for field_key, value in answers.items():
        if field_key not in allowed_fields or value is None or value == "":
            continue
        if isinstance(value, (dict, list)):
            raise ValueError(f"unsupported answer value for {field_key}")
        cleaned[field_key] = value
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                next_version = await conn.fetchval(
                    "SELECT COALESCE(MAX(version), 0) + 1 FROM candidate_answer_versions WHERE user_id = $1",
                    user_id,
                )
                version_row = await conn.fetchrow(
                    """
                    INSERT INTO candidate_answer_versions
                        (user_id, version, application_id, confirmed_at)
                    VALUES ($1, $2, $3, CASE WHEN $4 THEN now() ELSE NULL END)
                    RETURNING id, version, application_id
                    """,
                    user_id,
                    next_version,
                    application_id,
                    bool(confirm_sensitive and application_id),
                )
                for field_key, value in cleaned.items():
                    sensitivity = FIELD_SENSITIVITY.get(field_key, "ordinary")
                    confirmed = bool(confirm_sensitive and application_id and sensitivity != "ordinary")
                    await conn.execute(
                        """
                        INSERT INTO candidate_answers
                            (version_id, user_id, field_key, value, sensitivity_class,
                             provenance_type, provenance_ref, answer_hash,
                             confirmed_for_application)
                        VALUES ($1, $2, $3, $4, $5, 'user_entered', $6, $7, $8)
                        """,
                        version_row["id"],
                        user_id,
                        field_key,
                        str(value),
                        sensitivity,
                        application_id,
                        _hash_value(value),
                        confirmed,
                    )
        return await load_candidate_answer_snapshot(user_id, application_id=application_id)
    except AnswerBankStoreUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001
        raise AnswerBankStoreUnavailable("candidate answer save failed") from exc
