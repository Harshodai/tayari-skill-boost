"""Validated stage envelopes for the candidate-controlled workflow spine.

The envelope carries ownership, hashes, bounded provenance, approval state, and
explicit failure state. It never accepts raw resume text, job descriptions,
provider payloads, credentials, or contact data.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Final, Mapping

STAGE_KEYS: Final = (
    "resume_ingested",
    "job_discovered",
    "fit_analyzed",
    "resume_tailored",
    "cover_letter_created",
    "review_package_created",
    "tracking_recorded",
)
APPROVAL_STATES: Final = (
    "not_required",
    "pending_review",
    "candidate_confirmed",
    "approved",
    "expired",
    "rejected",
    "consumed",
)
_HASH_LENGTH = 64
_ALLOWED_PROVENANCE_KEYS = frozenset({"source", "source_url", "provider", "parser_version", "policy_version", "confidence", "observed_at", "freshness"})


class InvalidStageEnvelope(ValueError):
    """Raised when a workflow envelope is incomplete or contains unsafe data."""


@dataclass(frozen=True)
class WorkflowStageEnvelope:
    application_id: str
    user_id: str
    stage_key: str
    stage_version: int
    profile_snapshot_hash: str | None
    job_identity_key: str | None
    job_source_url: str | None
    job_provenance: dict[str, Any]
    artifact_hash: str | None
    artifact_version: str | None
    artifact_provenance: dict[str, Any]
    approval_state: str
    failure_state: dict[str, Any] | None
    input_hash: str | None
    output_hash: str | None
    observed_at: str
    tenant_id: str | None = None
    run_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _clean_hash(value: str | None, field: str) -> str | None:
    if value is None:
        return None
    value = value.strip().lower()
    if len(value) != _HASH_LENGTH or any(char not in "0123456789abcdef" for char in value):
        raise InvalidStageEnvelope(f"{field} must be a lowercase SHA-256 hex digest")
    return value


def _clean_provenance(value: Mapping[str, Any] | None, field: str) -> dict[str, Any]:
    cleaned = dict(value or {})
    unknown = set(cleaned) - _ALLOWED_PROVENANCE_KEYS
    if unknown:
        raise InvalidStageEnvelope(f"{field} contains unsupported keys: {sorted(unknown)}")
    # Raw content, credentials, and unbounded provider responses do not belong
    # in the durable envelope. Values are deliberately scalar and bounded.
    for key, item in cleaned.items():
        if isinstance(item, (dict, list, tuple, bytes)):
            raise InvalidStageEnvelope(f"{field}.{key} must be a scalar")
        if isinstance(item, str) and len(item) > 512:
            raise InvalidStageEnvelope(f"{field}.{key} exceeds the bounded length")
    return cleaned


def build_stage_envelope(
    *,
    application_id: str,
    user_id: str,
    stage_key: str,
    profile_snapshot_hash: str | None = None,
    job_identity_key: str | None = None,
    job_source_url: str | None = None,
    job_provenance: Mapping[str, Any] | None = None,
    artifact_hash: str | None = None,
    artifact_version: str | None = None,
    artifact_provenance: Mapping[str, Any] | None = None,
    approval_state: str = "not_required",
    failure_state: Mapping[str, Any] | None = None,
    input_hash: str | None = None,
    output_hash: str | None = None,
    observed_at: str | None = None,
    tenant_id: str | None = None,
    run_id: str | None = None,
    stage_version: int = 1,
) -> WorkflowStageEnvelope:
    application_id = application_id.strip()
    user_id = user_id.strip()
    if not application_id or not user_id:
        raise InvalidStageEnvelope("application_id and user_id are required")
    if stage_key not in STAGE_KEYS:
        raise InvalidStageEnvelope(f"unsupported stage_key: {stage_key}")
    if stage_version < 1:
        raise InvalidStageEnvelope("stage_version must be positive")
    if approval_state not in APPROVAL_STATES:
        raise InvalidStageEnvelope(f"unsupported approval_state: {approval_state}")
    if stage_key == "job_discovered" and not job_identity_key:
        raise InvalidStageEnvelope("job_discovered requires job_identity_key")
    if stage_key in {"resume_tailored", "cover_letter_created", "review_package_created"} and not artifact_hash:
        raise InvalidStageEnvelope(f"{stage_key} requires artifact_hash")
    failure = dict(failure_state) if failure_state is not None else None
    if failure is not None:
        if set(failure) - {"code", "message", "retryable"}:
            raise InvalidStageEnvelope("failure_state contains unsupported keys")
        if not failure.get("code") or not failure.get("message"):
            raise InvalidStageEnvelope("failure_state requires code and message")
        if len(str(failure["message"])) > 512:
            raise InvalidStageEnvelope("failure_state.message exceeds the bounded length")
    observed = observed_at or datetime.now(timezone.utc).isoformat()
    return WorkflowStageEnvelope(
        application_id=application_id,
        user_id=user_id,
        tenant_id=tenant_id.strip() if tenant_id else None,
        run_id=run_id.strip() if run_id else None,
        stage_key=stage_key,
        stage_version=stage_version,
        profile_snapshot_hash=_clean_hash(profile_snapshot_hash, "profile_snapshot_hash"),
        job_identity_key=job_identity_key.strip() if job_identity_key else None,
        job_source_url=job_source_url.strip() if job_source_url else None,
        job_provenance=_clean_provenance(job_provenance, "job_provenance"),
        artifact_hash=_clean_hash(artifact_hash, "artifact_hash"),
        artifact_version=artifact_version.strip() if artifact_version else None,
        artifact_provenance=_clean_provenance(artifact_provenance, "artifact_provenance"),
        approval_state=approval_state,
        failure_state=failure,
        input_hash=_clean_hash(input_hash, "input_hash"),
        output_hash=_clean_hash(output_hash, "output_hash"),
        observed_at=observed,
    )
