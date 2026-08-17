"""Durable AI provenance and disclosure primitives.

This module deliberately stores hashes and structured metadata rather than raw
prompts, resumes, provider payloads, or secrets. Database writes use the
service-role pool after the caller has supplied a verified owner identity.
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import UUID, uuid4

from app.services.db import get_pool

logger = logging.getLogger(__name__)

POLICY_VERSION = "ai-provenance-v1"
EVALUATOR_VERSION = "disclosure-evaluator-v1"

ORIGIN_CLASSIFICATIONS = {
    "human_only",
    "ai_assisted",
    "ai_generated",
    "ai_transformed",
    "machine_imported",
    "unknown",
    "disputed",
}
EVENT_TYPES = {
    "human_created",
    "human_edited",
    "ai_invoked",
    "ai_generated",
    "ai_transformed",
    "machine_imported",
    "a2a_received",
    "mcp_received",
    "provider_retrieved",
    "human_reviewed",
    "approved",
    "rejected",
    "disclosure_computed",
    "disclosure_presented",
    "exported",
    "corrected",
    "disputed",
    "failed",
    "deleted_or_redacted",
}


class ProvenanceError(RuntimeError):
    """Base provenance error."""


class ProvenanceUnavailable(ProvenanceError):
    """Raised when durable provenance storage is not available."""


class ProvenanceIntegrityConflict(ProvenanceError):
    """Raised when an idempotency key is reused for a different payload."""


@dataclass(frozen=True)
class DisclosureDecision:
    classification: str
    user_label: str
    reason_codes: tuple[str, ...]
    confidence: str
    human_review_status: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "classification": self.classification,
            "user_label": self.user_label,
            "reason_codes": list(self.reason_codes),
            "confidence": self.confidence,
            "human_review_status": self.human_review_status,
            "policy_version": POLICY_VERSION,
            "evaluator_version": EVALUATOR_VERSION,
        }


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def payload_hash(value: Any) -> str:
    return sha256_bytes(canonical_json(value))


def _json_value(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _json_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    return value


def _normalise_events(events: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return [dict(event) for event in events]


def classify_origin(events: Iterable[dict[str, Any]]) -> DisclosureDecision:
    """Derive a disclosure state from origin events; never trust a caller label."""
    rows = _normalise_events(events)
    if not rows:
        return DisclosureDecision("unknown", "Unknown provenance", ("NO_ORIGIN_EVENTS",), "unknown", "unknown")

    event_types = {str(row.get("event_type", "")) for row in rows}
    human_review = any(row.get("event_type") in {"human_reviewed", "human_edited", "approved"} for row in rows)
    disputed = "disputed" in event_types
    failed = "failed" in event_types
    has_ai_generation = "ai_generated" in event_types
    has_ai_transform = "ai_transformed" in event_types
    has_ai_invocation = "ai_invoked" in event_types
    has_import = bool(event_types & {"machine_imported", "provider_retrieved", "a2a_received", "mcp_received"})
    has_human_creation = "human_created" in event_types

    if disputed:
        return DisclosureDecision("disputed", "Under review", ("PROVENANCE_DISPUTED",), "low", "disputed")
    if failed and not (has_ai_generation or has_ai_transform or has_human_creation):
        return DisclosureDecision("unknown", "Unknown provenance", ("ORIGIN_EVENT_FAILED",), "low", "unknown")
    if has_ai_generation and not human_review:
        return DisclosureDecision(
            "ai_generated",
            "Created entirely by AI",
            ("AI_GENERATION_RECORDED", "NO_QUALIFYING_HUMAN_REVIEW"),
            "high",
            "pending" if has_ai_generation else "unknown",
        )
    if has_ai_transform and not human_review:
        return DisclosureDecision(
            "ai_transformed",
            "Transformed by AI",
            ("AI_TRANSFORMATION_RECORDED", "NO_QUALIFYING_HUMAN_REVIEW"),
            "high",
            "pending",
        )
    if has_ai_generation or has_ai_transform or has_ai_invocation:
        return DisclosureDecision(
            "ai_assisted",
            "Created with AI assistance",
            ("AI_CONTRIBUTION_RECORDED", "HUMAN_REVIEW_RECORDED"),
            "high",
            "reviewed" if human_review else "pending",
        )
    if has_import:
        return DisclosureDecision(
            "machine_imported",
            "Imported from an external system",
            ("MACHINE_OR_EXTERNAL_ORIGIN_RECORDED",),
            "high",
            "not_required",
        )
    if has_human_creation:
        return DisclosureDecision(
            "human_only",
            "Created by a human",
            ("HUMAN_ORIGIN_RECORDED", "NO_AI_EVENT_RECORDED"),
            "medium",
            "not_required",
        )
    return DisclosureDecision("unknown", "Unknown provenance", ("INSUFFICIENT_ORIGIN_EVIDENCE",), "unknown", "unknown")


class ProvenanceService:
    """Persistence facade for owner-scoped provenance and disclosure records."""

    def __init__(self, pool_getter=get_pool):
        self._pool_getter = pool_getter

    async def _pool(self):
        pool = await self._pool_getter()
        if not pool:
            raise ProvenanceUnavailable("durable provenance storage is unavailable")
        return pool

    async def create_artifact(
        self,
        *,
        user_id: str,
        artifact_type: str,
        content_hash: str,
        mime_type: str = "application/json",
        event_type: str = "ai_invoked",
        origin_actor: str = "ai_system",
        producer_type: str = "tayari_workflow",
        idempotency_key: str | None = None,
        metadata: dict[str, Any] | None = None,
        input_hashes: list[str] | None = None,
        output_hash: str | None = None,
        trace_id: str | None = None,
        application_id: str | None = None,
        model_id: str | None = None,
        parent_version_id: str | None = None,
        failure_code: str | None = None,
    ) -> dict[str, Any]:
        if not user_id or not artifact_type or not content_hash:
            raise ValueError("user_id, artifact_type, and content_hash are required")
        if len(content_hash) != 64 or any(char not in "0123456789abcdef" for char in content_hash):
            raise ValueError("content_hash must be a lowercase SHA-256 digest")
        if event_type not in EVENT_TYPES:
            raise ValueError("unsupported provenance event type")
        event_key = idempotency_key or str(uuid4())
        metadata_value = _json_value(metadata or {})
        inputs_value = _json_value(input_hashes or [])
        event_payload = {
            "artifact_type": artifact_type,
            "content_hash": content_hash,
            "event_type": event_type,
            "origin_actor": origin_actor,
            "producer_type": producer_type,
            "metadata": metadata_value,
            "input_hashes": inputs_value,
            "output_hash": output_hash,
            "trace_id": trace_id,
            "application_id": application_id,
            "model_id": model_id,
            "parent_version_id": parent_version_id,
            "failure_code": failure_code,
        }
        event_payload_digest = payload_hash(event_payload)
        pool = await self._pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                artifact_id = await conn.fetchval(
                    """
                    INSERT INTO public.artifacts
                        (user_id, artifact_type, origin_classification, disclosure_status)
                    VALUES ($1, $2, 'unknown', 'not_evaluated')
                    RETURNING id
                    """,
                    user_id,
                    artifact_type,
                )
                version_id = await conn.fetchval(
                    """
                    INSERT INTO public.artifact_versions
                        (artifact_id, user_id, parent_version_id, content_hash, mime_type)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                    """,
                    artifact_id,
                    user_id,
                    parent_version_id,
                    content_hash,
                    mime_type,
                )
                await conn.execute(
                    "UPDATE public.artifacts SET current_version_id = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2",
                    artifact_id,
                    user_id,
                    version_id,
                )
                await self._insert_event(
                    conn,
                    user_id=user_id,
                    artifact_id=artifact_id,
                    artifact_version_id=version_id,
                    idempotency_key=event_key,
                    event_type=event_type,
                    origin_actor=origin_actor,
                    producer_type=producer_type,
                    application_id=application_id,
                    model_id=model_id,
                    parent_content_hash=None,
                    input_hashes=inputs_value,
                    output_hash=output_hash or content_hash,
                    metadata=metadata_value,
                    trace_id=trace_id,
                    failure_code=failure_code,
                    payload_digest=event_payload_digest,
                )
        return {"artifact_id": str(artifact_id), "version_id": str(version_id), "content_hash": content_hash}

    async def _insert_event(self, conn, **kwargs) -> str:
        user_id = kwargs["user_id"]
        key = kwargs["idempotency_key"]
        existing = await conn.fetchrow(
            "SELECT id, payload_hash FROM public.artifact_origin_events WHERE user_id = $1 AND idempotency_key = $2",
            user_id,
            key,
        )
        if existing:
            if existing["payload_hash"] != kwargs["payload_digest"]:
                raise ProvenanceIntegrityConflict("provenance idempotency key reused with a different payload")
            return str(existing["id"])
        event_id = await conn.fetchval(
            """
            INSERT INTO public.artifact_origin_events
                (user_id, artifact_id, artifact_version_id, idempotency_key,
                 event_type, origin_actor, producer_type, application_id, model_id,
                 parent_content_hash, input_hashes, output_hash, metadata, trace_id,
                 policy_version, evidence_refs, failure_code, payload_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
                    $12, $13::jsonb, $14, $15, '[]'::jsonb, $16, $17)
            RETURNING id
            """,
            user_id,
            kwargs["artifact_id"],
            kwargs["artifact_version_id"],
            key,
            kwargs["event_type"],
            kwargs["origin_actor"],
            kwargs["producer_type"],
            kwargs.get("application_id"),
            kwargs.get("model_id"),
            kwargs.get("parent_content_hash"),
            json.dumps(kwargs.get("input_hashes", [])),
            kwargs.get("output_hash"),
            json.dumps(kwargs.get("metadata", {})),
            kwargs.get("trace_id"),
            POLICY_VERSION,
            kwargs.get("failure_code"),
            kwargs["payload_digest"],
        )
        return str(event_id)

    async def list_artifacts(
        self,
        *,
        user_id: str,
        classifications: list[str] | None = None,
        disclosure_status: str | None = None,
        created_after: datetime | None = None,
        created_before: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        if not user_id:
            raise ValueError("user_id is required")
        limit = max(1, min(limit, 500))
        offset = max(0, offset)
        clauses = ["user_id = $1"]
        args: list[Any] = [user_id]
        index = 2
        if classifications:
            invalid = set(classifications) - ORIGIN_CLASSIFICATIONS
            if invalid:
                raise ValueError("unsupported origin classification")
            clauses.append(f"origin_classification = ANY(${index})")
            args.append(classifications)
            index += 1
        if disclosure_status:
            clauses.append(f"disclosure_status = ${index}")
            args.append(disclosure_status)
            index += 1
        if created_after:
            clauses.append(f"created_at >= ${index}")
            args.append(created_after)
            index += 1
        if created_before:
            clauses.append(f"created_at < ${index}")
            args.append(created_before)
            index += 1
        args.extend([limit, offset])
        query = f"""
            SELECT id, user_id, artifact_type, current_version_id,
                   origin_classification, disclosure_status, sensitivity,
                   retention_class, created_at, updated_at
            FROM public.artifacts
            WHERE {' AND '.join(clauses)}
            ORDER BY created_at DESC, id DESC
            LIMIT ${index} OFFSET ${index + 1}
        """
        pool = await self._pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
        return [dict(row) for row in rows]

    async def get_artifact(self, *, user_id: str, artifact_id: str) -> dict[str, Any] | None:
        if not user_id or not artifact_id:
            return None
        pool = await self._pool()
        async with pool.acquire() as conn:
            artifact = await conn.fetchrow(
                """
                SELECT id, user_id, artifact_type, current_version_id,
                       origin_classification, disclosure_status, sensitivity,
                       retention_class, created_at, updated_at
                FROM public.artifacts WHERE id = $1 AND user_id = $2
                """,
                artifact_id,
                user_id,
            )
            if not artifact:
                return None
            versions = await conn.fetch(
                """
                SELECT id, artifact_id, user_id, parent_version_id, content_hash,
                       mime_type, storage_ref, created_at, superseded_at
                FROM public.artifact_versions
                WHERE artifact_id = $1 AND user_id = $2
                ORDER BY created_at ASC, id ASC
                """,
                artifact_id,
                user_id,
            )
            events = await conn.fetch(
                """
                SELECT id, artifact_id, artifact_version_id, idempotency_key,
                       event_type, origin_actor, producer_type, application_id,
                       model_id, input_hashes, output_hash, metadata, trace_id,
                       occurred_at, policy_version, evidence_refs, failure_code
                FROM public.artifact_origin_events
                WHERE artifact_id = $1 AND user_id = $2
                ORDER BY occurred_at ASC, id ASC
                """,
                artifact_id,
                user_id,
            )
            disclosures = await conn.fetch(
                """
                SELECT id, artifact_id, artifact_version_id, classification,
                       user_label, reason_codes, confidence, human_review_status,
                       disclosure_status, audience, channel, policy_version,
                       evaluator_version, supporting_event_ids,
                       redacted_evidence_refs, created_at, updated_at
                FROM public.artifact_disclosures
                WHERE artifact_id = $1 AND user_id = $2
                ORDER BY created_at DESC, id DESC
                """,
                artifact_id,
                user_id,
            )
        return {
            "artifact": dict(artifact),
            "versions": [dict(row) for row in versions],
            "origin_events": [dict(row) for row in events],
            "disclosures": [dict(row) for row in disclosures],
        }

    async def export_artifacts(
        self,
        *,
        user_id: str,
        classifications: list[str] | None = None,
        created_after: datetime | None = None,
        created_before: datetime | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        rows = await self.list_artifacts(
            user_id=user_id,
            classifications=classifications,
            created_after=created_after,
            created_before=created_before,
            limit=min(limit, 100),
        )
        details = []
        unknown_count = 0
        for row in rows:
            detail = await self.get_artifact(user_id=user_id, artifact_id=str(row["id"]))
            if detail:
                details.append(detail)
                if detail["artifact"].get("origin_classification") == "unknown":
                    unknown_count += 1
        return {
            "schema": "tayari.ai-provenance.export.v1",
            "policy_version": POLICY_VERSION,
            "evaluator_version": EVALUATOR_VERSION,
            "owner_id": user_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(details),
            "completeness": {
                "unknown_artifacts": unknown_count,
                "provenance_complete": len(details) - unknown_count,
            },
            "artifacts": details,
        }

    async def compute_disclosure(self, *, user_id: str, artifact_id: str, channel: str = "internal") -> dict[str, Any]:
        detail = await self.get_artifact(user_id=user_id, artifact_id=artifact_id)
        if not detail:
            raise KeyError("artifact_not_found")
        decision = classify_origin(detail["origin_events"])
        current_version = detail["artifact"]["current_version_id"]
        if not current_version:
            raise ProvenanceError("artifact has no current version")
        pool = await self._pool()
        async with pool.acquire() as conn:
            disclosure_id = await conn.fetchval(
                """
                INSERT INTO public.artifact_disclosures
                    (user_id, artifact_id, artifact_version_id, classification,
                     user_label, reason_codes, confidence, human_review_status,
                     disclosure_status, channel, policy_version, evaluator_version,
                     supporting_event_ids)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'required_pending',
                        $9, $10, $11, $12::jsonb)
                ON CONFLICT (artifact_version_id, user_id, policy_version, evaluator_version, channel)
                DO UPDATE SET classification = EXCLUDED.classification,
                              user_label = EXCLUDED.user_label,
                              reason_codes = EXCLUDED.reason_codes,
                              confidence = EXCLUDED.confidence,
                              human_review_status = EXCLUDED.human_review_status,
                              updated_at = NOW()
                RETURNING id
                """,
                user_id,
                artifact_id,
                current_version,
                decision.classification,
                decision.user_label,
                json.dumps(list(decision.reason_codes)),
                decision.confidence,
                decision.human_review_status,
                channel,
                POLICY_VERSION,
                EVALUATOR_VERSION,
                json.dumps([str(event["id"]) for event in detail["origin_events"]]),
            )
            await conn.execute(
                "UPDATE public.artifacts SET origin_classification = $3, disclosure_status = 'required_pending', updated_at = NOW() WHERE id = $1 AND user_id = $2",
                artifact_id,
                user_id,
                decision.classification,
            )
        return {"disclosure_id": str(disclosure_id), "artifact_id": artifact_id, **decision.as_dict()}


provenance_service = ProvenanceService()

__all__ = [
    "DisclosureDecision",
    "EVALUATOR_VERSION",
    "EVENT_TYPES",
    "ORIGIN_CLASSIFICATIONS",
    "POLICY_VERSION",
    "ProvenanceError",
    "ProvenanceIntegrityConflict",
    "ProvenanceService",
    "ProvenanceUnavailable",
    "classify_origin",
    "canonical_json",
    "payload_hash",
    "provenance_service",
    "sha256_bytes",
    "sha256_text",
]
