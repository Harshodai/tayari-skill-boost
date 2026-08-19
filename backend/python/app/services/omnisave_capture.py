from __future__ import annotations

import hashlib
import json
import uuid as uuid_lib
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional
from urllib.parse import urlsplit, urlunsplit

from app.services.db import get_pool

SUPPORTED_CAPTURE_PLATFORMS = {"linkedin", "medium", "substack", "instagram"}
ALLOWED_TRIGGER_TYPES = {"manual", "automatic", "extension"}
TERMINAL_RUN_STATUSES = {"completed", "cancelled", "blocked", "failed"}
RUN_STATUSES = {
    "queued",
    "running",
    "partial",
    "completed",
    "cancel_requested",
    "cancelled",
    "blocked",
    "failed",
}
ITEM_STATUSES = {"pending", "running", "imported", "skipped", "blocked", "failed"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: Any) -> Optional[str]:
    return value.isoformat() if value else None


def _canonical_url(value: str) -> str:
    parsed = urlsplit(str(value or "").strip())
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("https_url_required")
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", parsed.query, ""))


def _source_key(platform: str, url: str) -> str:
    return hashlib.sha256(f"{platform}:{url}".encode("utf-8")).hexdigest()


def _bounded_media(media: Any) -> list[dict[str, Any]]:
    if not isinstance(media, list):
        return []
    normalized: list[dict[str, Any]] = []
    for value in media[:20]:
        if not isinstance(value, dict):
            continue
        raw_url = str(value.get("url") or "").strip()
        if not raw_url:
            continue
        try:
            safe_url = _canonical_url(raw_url)
        except ValueError:
            continue
        normalized.append(
            {
                "url": safe_url[:2048],
                "type": str(value.get("type") or "unknown")[:64],
                "alt": str(value.get("alt") or "")[:500],
                "width": int(value["width"]) if str(value.get("width") or "").isdigit() else None,
                "height": int(value["height"]) if str(value.get("height") or "").isdigit() else None,
            }
        )
    return normalized


def _run_payload(row: Any, user_id: str) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "user_id": user_id,
        "platform": row["platform"],
        "source_page_url": row["source_page_url"],
        "trigger_type": row["trigger_type"],
        "status": row["status"],
        "requested_limit": int(row["requested_limit"]),
        "page_cursor": row.get("page_cursor"),
        "page_count": int(row["page_count"] or 0),
        "discovered_count": int(row["discovered_count"] or 0),
        "imported_count": int(row["imported_count"] or 0),
        "skipped_count": int(row["skipped_count"] or 0),
        "failed_count": int(row["failed_count"] or 0),
        "checkpoint": row.get("checkpoint") or {},
        "last_error": row.get("last_error"),
        "cancel_requested_at": _iso(row.get("cancel_requested_at")),
        "heartbeat_at": _iso(row.get("heartbeat_at")),
        "lease_until": _iso(row.get("lease_until")),
        "started_at": _iso(row.get("started_at")),
        "completed_at": _iso(row.get("completed_at")),
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
    }


def _item_payload(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "run_id": str(row["run_id"]),
        "source_key": row["source_key"],
        "source_url": row["source_url"],
        "source_platform": row["source_platform"],
        "ordinal": int(row["ordinal"] or 0),
        "title": row.get("title") or "",
        "author": row.get("author") or "",
        "content": row.get("content") or "",
        "media": row.get("media") or [],
        "status": row["status"],
        "attempts": int(row["attempts"] or 0),
        "source_id": str(row["source_id"]) if row.get("source_id") else None,
        "last_error": row.get("last_error"),
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
    }


class OmniSaveCaptureStore:
    async def _pool(self) -> Any:
        pool = await get_pool()
        if pool is None:
            raise RuntimeError("knowledge_store_unavailable")
        return pool

    @staticmethod
    def _validate_platform(platform: str) -> str:
        normalized = str(platform or "").strip().lower()
        if normalized not in SUPPORTED_CAPTURE_PLATFORMS:
            raise ValueError("unsupported_capture_platform")
        return normalized

    async def create_run(
        self,
        user_id: str,
        *,
        platform: str,
        source_page_url: str,
        trigger_type: str = "manual",
        requested_limit: int = 250,
        consent_acknowledged: bool = False,
    ) -> dict[str, Any]:
        if not consent_acknowledged:
            raise ValueError("capture_consent_required")
        platform = self._validate_platform(platform)
        if trigger_type not in ALLOWED_TRIGGER_TYPES:
            raise ValueError("invalid_capture_trigger")
        if requested_limit < 1 or requested_limit > 5000:
            raise ValueError("invalid_capture_limit")
        source_page_url = _canonical_url(source_page_url)
        user_uuid = uuid_lib.UUID(user_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO public.omnisave_capture_runs
                    (user_id, platform, source_page_url, trigger_type, requested_limit,
                     consent_acknowledged_at, status, heartbeat_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), 'queued', NOW())
                RETURNING *
                """,
                user_uuid,
                platform,
                source_page_url,
                trigger_type,
                requested_limit,
            )
        return _run_payload(row, user_id)

    async def get_run(self, user_id: str, run_id: str) -> dict[str, Any]:
        user_uuid = uuid_lib.UUID(user_id)
        run_uuid = uuid_lib.UUID(run_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM public.omnisave_capture_runs WHERE id = $1 AND user_id = $2",
                run_uuid,
                user_uuid,
            )
        if row is None:
            raise KeyError("capture_run_not_found")
        return _run_payload(row, user_id)

    async def list_runs(self, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        user_uuid = uuid_lib.UUID(user_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM public.omnisave_capture_runs
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                user_uuid,
                max(1, min(limit, 100)),
            )
        return [_run_payload(row, user_id) for row in rows]

    async def enqueue_items(self, user_id: str, run_id: str, items: Iterable[dict[str, Any]]) -> dict[str, int]:
        user_uuid = uuid_lib.UUID(user_id)
        run_uuid = uuid_lib.UUID(run_id)
        pool = await self._pool()
        discovered = 0
        inserted = 0
        async with pool.acquire() as conn:
            run = await conn.fetchrow(
                "SELECT platform, requested_limit, status FROM public.omnisave_capture_runs WHERE id = $1 AND user_id = $2",
                run_uuid,
                user_uuid,
            )
            if run is None:
                raise KeyError("capture_run_not_found")
            if run["status"] in TERMINAL_RUN_STATUSES:
                raise ValueError("capture_run_terminal")
            for ordinal, item in enumerate(items):
                if not isinstance(item, dict):
                    continue
                platform = self._validate_platform(item.get("platform") or run["platform"])
                if platform != run["platform"]:
                    raise ValueError("capture_platform_mismatch")
                url = _canonical_url(str(item.get("url") or ""))
                source_key = _source_key(platform, url)
                discovered += 1
                result = await conn.execute(
                    """
                    INSERT INTO public.omnisave_capture_items
                        (run_id, user_id, source_key, source_url, source_platform, ordinal,
                         title, author, content, media)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
                    ON CONFLICT (run_id, source_key) DO NOTHING
                    """,
                    run_uuid,
                    user_uuid,
                    source_key,
                    url,
                    platform,
                    ordinal,
                    str(item.get("title") or "")[:240],
                    str(item.get("author") or "")[:160],
                    str(item.get("content") or "")[:12000],
                    json.dumps(_bounded_media(item.get("media"))),
                )
                if result == "INSERT 0 1":
                    inserted += 1
                if discovered >= int(run["requested_limit"]):
                    break
            await conn.execute(
                """
                UPDATE public.omnisave_capture_runs
                SET discovered_count = (
                        SELECT COUNT(*) FROM public.omnisave_capture_items WHERE run_id = $1 AND user_id = $2
                    ),
                    updated_at = NOW()
                WHERE id = $1 AND user_id = $2
                """,
                run_uuid,
                user_uuid,
            )
        return {"discovered": discovered, "inserted": inserted}

    async def claim_run(self, user_id: str, run_id: str, lease_seconds: int = 120) -> dict[str, Any]:
        user_uuid = uuid_lib.UUID(user_id)
        run_uuid = uuid_lib.UUID(run_id)
        pool = await self._pool()
        lease_until = _now() + timedelta(seconds=max(30, min(900, lease_seconds)))
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE public.omnisave_capture_runs
                SET status = 'running', started_at = COALESCE(started_at, NOW()),
                    heartbeat_at = NOW(), lease_until = $3, updated_at = NOW()
                WHERE id = $1 AND user_id = $2
                  AND status IN ('queued', 'partial', 'running')
                  AND (status <> 'running' OR lease_until IS NULL OR lease_until < NOW())
                RETURNING *
                """,
                run_uuid,
                user_uuid,
                lease_until,
            )
        if row is None:
            raise ValueError("capture_run_unavailable")
        return _run_payload(row, user_id)

    async def heartbeat(self, user_id: str, run_id: str, lease_seconds: int = 120) -> dict[str, Any]:
        user_uuid = uuid_lib.UUID(user_id)
        run_uuid = uuid_lib.UUID(run_id)
        lease_until = _now() + timedelta(seconds=max(30, min(900, lease_seconds)))
        pool = await self._pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE public.omnisave_capture_runs
                SET heartbeat_at = NOW(), lease_until = $3, updated_at = NOW()
                WHERE id = $1 AND user_id = $2 AND status = 'running'
                RETURNING *
                """,
                run_uuid,
                user_uuid,
                lease_until,
            )
        if row is None:
            raise KeyError("capture_run_not_running")
        return _run_payload(row, user_id)

    async def checkpoint(
        self,
        user_id: str,
        run_id: str,
        *,
        page_cursor: Optional[str] = None,
        page_count: Optional[int] = None,
        checkpoint: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        user_uuid = uuid_lib.UUID(user_id)
        run_uuid = uuid_lib.UUID(run_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE public.omnisave_capture_runs
                SET page_cursor = COALESCE($3, page_cursor),
                    page_count = COALESCE($4, page_count),
                    checkpoint = CASE WHEN $5::jsonb IS NULL THEN checkpoint ELSE $5::jsonb END,
                    heartbeat_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND user_id = $2 AND status IN ('queued', 'running', 'partial')
                RETURNING *
                """,
                run_uuid,
                user_uuid,
                page_cursor,
                max(0, page_count) if page_count is not None else None,
                json.dumps(checkpoint) if checkpoint is not None else None,
            )
        if row is None:
            raise KeyError("capture_run_not_found")
        return _run_payload(row, user_id)

    async def request_cancel(self, user_id: str, run_id: str) -> dict[str, Any]:
        user_uuid = uuid_lib.UUID(user_id)
        run_uuid = uuid_lib.UUID(run_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE public.omnisave_capture_runs
                SET status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE 'cancel_requested' END,
                    cancel_requested_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND user_id = $2 AND status NOT IN ('completed', 'cancelled', 'blocked', 'failed')
                RETURNING *
                """,
                run_uuid,
                user_uuid,
            )
        if row is None:
            return await self.get_run(user_id, run_id)
        return _run_payload(row, user_id)

    async def is_cancel_requested(self, user_id: str, run_id: str) -> bool:
        user_uuid = uuid_lib.UUID(user_id)
        run_uuid = uuid_lib.UUID(run_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            return bool(
                await conn.fetchval(
                    "SELECT status IN ('cancel_requested', 'cancelled') FROM public.omnisave_capture_runs WHERE id = $1 AND user_id = $2",
                    run_uuid,
                    user_uuid,
                )
            )

    async def finish_run(
        self,
        user_id: str,
        run_id: str,
        *,
        status: str,
        imported_count: int,
        skipped_count: int,
        failed_count: int,
        last_error: Optional[str] = None,
    ) -> dict[str, Any]:
        if status not in RUN_STATUSES:
            raise ValueError("invalid_capture_status")
        user_uuid = uuid_lib.UUID(user_id)
        run_uuid = uuid_lib.UUID(run_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE public.omnisave_capture_runs
                SET status = $3, imported_count = GREATEST(0, $4), skipped_count = GREATEST(0, $5),
                    failed_count = GREATEST(0, $6), last_error = $7,
                    completed_at = CASE WHEN $3 IN ('completed', 'cancelled', 'blocked', 'failed') THEN NOW() ELSE completed_at END,
                    lease_until = NULL, heartbeat_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND user_id = $2
                RETURNING *
                """,
                run_uuid,
                user_uuid,
                status,
                imported_count,
                skipped_count,
                failed_count,
                str(last_error)[:500] if last_error else None,
            )
        if row is None:
            raise KeyError("capture_run_not_found")
        return _run_payload(row, user_id)

    async def list_items(self, user_id: str, run_id: str, limit: int = 100) -> list[dict[str, Any]]:
        user_uuid = uuid_lib.UUID(user_id)
        run_uuid = uuid_lib.UUID(run_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT i.* FROM public.omnisave_capture_items i
                JOIN public.omnisave_capture_runs r ON r.id = i.run_id AND r.user_id = i.user_id
                WHERE i.run_id = $1 AND i.user_id = $2
                ORDER BY i.ordinal ASC, i.created_at ASC
                LIMIT $3
                """,
                run_uuid,
                user_uuid,
                max(1, min(limit, 500)),
            )
        return [_item_payload(row) for row in rows]


_capture_store = OmniSaveCaptureStore()


def get_omnisave_capture_store() -> OmniSaveCaptureStore:
    return _capture_store
