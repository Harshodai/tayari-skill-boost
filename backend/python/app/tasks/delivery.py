"""Background dispatcher for candidate-opted-in Telegram and WhatsApp notifications."""
from __future__ import annotations

import asyncio
import logging

from app.celery_app import celery_app
from app.services.delivery_ledger import dispatch_once

logger = logging.getLogger(__name__)
MAX_DRAIN_PER_TICK = 25


@celery_app.task(
    name="delivery.dispatch_pending_messages",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def dispatch_pending_messages(self) -> dict[str, int]:
    """Drain a bounded batch from the durable ledger.

    The ledger claim is atomic and each provider result is written back before
    the next message is claimed.  A lost worker leaves ``sending`` records for
    operational reconciliation rather than pretending that delivery happened.
    """

    async def _drain() -> int:
        count = 0
        for _ in range(MAX_DRAIN_PER_TICK):
            delivery = await dispatch_once()
            if delivery is None:
                break
            count += 1
        return count

    delivered_or_recorded = asyncio.run(_drain())
    logger.info("delivery ledger dispatcher processed %s record(s)", delivered_or_recorded)
    return {"processed": delivered_or_recorded}


__all__ = ["dispatch_pending_messages"]
