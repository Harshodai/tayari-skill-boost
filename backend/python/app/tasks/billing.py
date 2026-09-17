"""Durable reconciliation for verified-receipt credit debits."""
from __future__ import annotations

import asyncio

from app.celery_app import celery_app


@celery_app.task(
    name="billing.reconcile_verified_receipt_debit",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=3,
)
def reconcile_verified_receipt_debit(
    self,
    *,
    user_id: str,
    reference_id: str,
    job_title: str | None = None,
    company: str | None = None,
) -> dict:
    """Retry one idempotent debit without carrying resume or application data."""
    if not user_id or not reference_id:
        raise ValueError("user_id and reference_id are required")

    from app.services.submission_receipt import debit_submission_credit

    result = asyncio.run(
        debit_submission_credit(
            user_id=user_id,
            receipt_id=reference_id,
            run_id=reference_id,
            job_title=job_title,
            company=company,
            verified=True,
        )
    )
    if result.get("status") != "debited":
        raise RuntimeError(f"verified receipt debit not reconciled: {result.get('status', 'unknown')}")
    return {"status": "debited", "charged": 1, "reference_id": reference_id}