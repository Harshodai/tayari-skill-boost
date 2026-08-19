"""Celery worker for durable Apify research runs."""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.celery_app import celery_app
from app.services.external_research import (
    ApifyResearchProvider,
    ProviderRejected,
    ResearchContext,
    ResearchRequest,
)
from app.services.external_research_runs import (
    claim_external_research_run,
    heartbeat_external_research_run,
    update_external_research_run,
)
from app.services.provenance import ProvenanceError, ProvenanceUnavailable, payload_hash, provenance_service, sha256_text

logger = logging.getLogger(__name__)


async def _heartbeat(job_id: str, lease_owner: str, stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=30.0)
        except asyncio.TimeoutError:
            await heartbeat_external_research_run(job_id, lease_owner)


async def _execute(job_id: str, task_id: str | None) -> dict[str, Any]:
    lease_owner = f"{task_id or 'unknown'}:{uuid.uuid4()}"
    job = await claim_external_research_run(job_id, lease_owner)
    if not job:
        return {"job_id": job_id, "status": "not_claimed"}

    stop = asyncio.Event()
    heartbeat_task = asyncio.create_task(_heartbeat(job_id, lease_owner, stop))
    try:
        request = ResearchRequest(query=job["query"], provider="apify", limit=job["requested_limit"])
        context = ResearchContext(subject=job["subject"], tenant_id=str(job["tenant_id"]) if job.get("tenant_id") else None, request_id=job.get("request_id"))

        async def _record_provider_run(provider_run_id: str) -> None:
            await update_external_research_run(job_id, provider_run_id=provider_run_id, progress=10)

        result = await ApifyResearchProvider().search(request, context, on_run_started=_record_provider_run)
        result_payload = result.model_dump(mode="json")
        try:
            provenance = await provenance_service.create_artifact(
                user_id=str(job["user_id"]),
                artifact_type="external_research_result",
                content_hash=payload_hash(result_payload),
                event_type="machine_imported",
                origin_actor="external_provider",
                producer_type="apify",
                idempotency_key=f"external-research-run:{job_id}",
                metadata={"workflow": "external_research", "provider": "apify", "source_count": result.result_count, "truncated": result.truncated},
                input_hashes=[sha256_text(request.query)],
                output_hash=payload_hash(result_payload),
                trace_id=job.get("request_id"),
            )
            result_payload["provenance"] = {
                "artifact_id": provenance["artifact_id"],
                "version_id": provenance["version_id"],
                "classification": "machine_imported",
                "policy_version": "ai-provenance-v1",
            }
        except ProvenanceUnavailable:
            result_payload["provenance"] = {"status": "unavailable", "classification": "unknown", "reason": "durable_provenance_storage_unavailable"}
        except (ProvenanceError, ValueError):
            result_payload["provenance"] = {"status": "failed", "classification": "unknown", "reason": "provenance_capture_failed"}
        await update_external_research_run(
            job_id,
            status="succeeded",
            progress=100,
            result=result_payload,
            result_count=result.result_count,
            truncated=result.truncated,
            completed_at=datetime.now(timezone.utc),
            lease_owner=None,
            lease_expires_at=None,
        )
        return {"job_id": job_id, "status": "succeeded", "result_count": result.result_count}
    except ProviderRejected as exc:
        await update_external_research_run(
            job_id,
            status="timed_out" if "timed out" in str(exc).lower() else "failed",
            error_code="provider_rejected",
            error_message=str(exc)[:1000],
            completed_at=datetime.now(timezone.utc),
            lease_owner=None,
            lease_expires_at=None,
        )
        logger.info("Apify research job failed job_id=%s reason=%s", job_id, str(exc))
        return {"job_id": job_id, "status": "failed"}
    except Exception as exc:  # noqa: BLE001
        await update_external_research_run(
            job_id,
            status="failed",
            error_code="worker_error",
            error_message=type(exc).__name__,
            completed_at=datetime.now(timezone.utc),
            lease_owner=None,
            lease_expires_at=None,
        )
        logger.exception("Apify research worker failed job_id=%s", job_id)
        return {"job_id": job_id, "status": "failed"}
    finally:
        stop.set()
        await heartbeat_task


@celery_app.task(name="external_research.run_apify", bind=True)
def run_apify_research(self, job_id: str) -> dict[str, Any]:
    """Execute one durable, owner-scoped Apify research run."""
    return asyncio.run(_execute(job_id, getattr(self.request, "id", None)))


__all__ = ["run_apify_research"]
