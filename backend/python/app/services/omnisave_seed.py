from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from app.services.db import get_pool
from app.services.omnisave_service import get_omnisave_service

logger = logging.getLogger(__name__)
MAX_SEED_ROWS = 10_000


def _first_value(row: Dict[str, str], names: List[str]) -> str:
    lowered = {str(key).strip().lower(): (value or "").strip() for key, value in row.items()}
    for name in names:
        value = lowered.get(name.lower())
        if value:
            return value
    return ""


def _normalise_url(value: str) -> Optional[str]:
    if not value:
        return None
    candidate = value.strip()
    if candidate.startswith("<") and ">" in candidate:
        candidate = candidate.split(">", 1)[-1].split("<", 1)[0]
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    parsed = parsed._replace(fragment="")
    return parsed.geturl()


def parse_saved_items(csv_text: str) -> List[Dict[str, Any]]:
    if not csv_text or len(csv_text) > 5_000_000:
        raise ValueError("seed_csv_empty_or_too_large")
    reader = csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff")))
    if not reader.fieldnames:
        raise ValueError("seed_csv_missing_headers")
    items: List[Dict[str, Any]] = []
    seen = set()
    for row in reader:
        url = _normalise_url(_first_value(row, ["saved post url", "post url", "url", "link", "saved item url", "canonical url"]))
        if not url or url in seen:
            continue
        seen.add(url)
        items.append(
            {
                "source_url": url,
                "source_platform": "linkedin" if "linkedin.com" in urlparse(url).netloc.lower() else "custom_url",
                "saved_at": _first_value(row, ["saved date", "date saved", "saved_at", "created at"]) or None,
                "title": _first_value(row, ["title", "post title", "name"]) or None,
                "author": _first_value(row, ["author", "creator", "member"]) or None,
            }
        )
        if len(items) >= MAX_SEED_ROWS:
            break
    if not items:
        raise ValueError("seed_csv_no_urls")
    return items


class OmniSaveSeedStore:
    async def create_job(self, user_id: str, file_name: str, csv_text: str) -> Dict[str, Any]:
        items = parse_saved_items(csv_text)
        pool = await get_pool()
        if pool is None:
            raise RuntimeError("knowledge_store_unavailable")
        user_uuid = uuid.UUID(user_id)
        async with pool.acquire() as conn:
            async with conn.transaction():
                job = await conn.fetchrow(
                    """
                    INSERT INTO public.omnisave_seed_import_jobs (user_id, file_name, source_platform, total_count)
                    VALUES ($1, $2, 'linkedin', $3)
                    RETURNING id, file_name, source_platform, status, total_count, hydrated_count,
                              imported_count, skipped_count, failed_count, next_cursor, last_error,
                              created_at, updated_at, completed_at
                    """,
                    user_uuid,
                    (file_name or "saved-items.csv")[:240],
                    len(items),
                )
                for item in items:
                    saved_at = None
                    if item.get("saved_at"):
                        try:
                            saved_at = datetime.fromisoformat(str(item["saved_at"]).replace("Z", "+00:00"))
                        except ValueError:
                            saved_at = None
                    await conn.execute(
                        """
                        INSERT INTO public.omnisave_seed_import_items
                            (job_id, user_id, source_url, source_platform, saved_at, title, author)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (job_id, source_url) DO NOTHING
                        """,
                        job["id"], user_uuid, item["source_url"], item["source_platform"], saved_at, item.get("title"), item.get("author"),
                    )
        return self._serialise_job(job)

    async def list_jobs(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        pool = await get_pool()
        if pool is None:
            raise RuntimeError("knowledge_store_unavailable")
        rows = await pool.fetch(
            """
            SELECT id, file_name, source_platform, status, total_count, hydrated_count,
                   imported_count, skipped_count, failed_count, next_cursor, last_error,
                   created_at, updated_at, completed_at
            FROM public.omnisave_seed_import_jobs
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            uuid.UUID(user_id),
            max(1, min(limit, 100)),
        )
        return [self._serialise_job(row) for row in rows]

    async def get_job(self, user_id: str, job_id: str) -> Dict[str, Any]:
        pool = await get_pool()
        if pool is None:
            raise RuntimeError("knowledge_store_unavailable")
        row = await pool.fetchrow(
            """
            SELECT id, file_name, source_platform, status, total_count, hydrated_count,
                   imported_count, skipped_count, failed_count, next_cursor, last_error,
                   created_at, updated_at, completed_at
            FROM public.omnisave_seed_import_jobs
            WHERE id = $1 AND user_id = $2
            """,
            uuid.UUID(job_id),
            uuid.UUID(user_id),
        )
        if row is None:
            raise KeyError("seed_job_not_found")
        return self._serialise_job(row)

    async def hydrate(self, user_id: str, job_id: str, limit: int = 20) -> Dict[str, Any]:
        pool = await get_pool()
        if pool is None:
            raise RuntimeError("knowledge_store_unavailable")
        job_uuid = uuid.UUID(job_id)
        user_uuid = uuid.UUID(user_id)
        # Reclaim stale 'running' rows (crashed hydrations): anything last
        # touched more than STALE_RUNNING_AGE ago is treated as pending again.
        rows = await pool.fetch(
            """
            SELECT id, source_url, source_platform, title, author, attempts
            FROM public.omnisave_seed_import_items
            WHERE job_id = $1 AND user_id = $2 AND attempts < 3
              AND (
                status IN ('pending', 'failed')
                OR (status = 'running' AND updated_at < NOW() - INTERVAL '5 minutes')
              )
            ORDER BY created_at
            LIMIT $3
            """,
            job_uuid,
            user_uuid,
            max(1, min(limit, 100)),
        )
        if not rows:
            await self._refresh_job(pool, job_uuid, user_uuid)
            return await self.get_job(user_id, job_id)
        await pool.execute(
            "UPDATE public.omnisave_seed_import_jobs SET status = 'running', updated_at = NOW() WHERE id = $1 AND user_id = $2",
            job_uuid,
            user_uuid,
        )
        for row in rows:
            await pool.execute(
                "UPDATE public.omnisave_seed_import_items SET status = 'running', attempts = attempts + 1, updated_at = NOW() WHERE id = $1 AND user_id = $2",
                row["id"],
                user_uuid,
            )
        service = get_omnisave_service()
        batch_items = [
            {
                "url": row["source_url"],
                "platform": row["source_platform"],
                "title": row["title"] or row["source_url"],
                "author": row["author"] or "Unknown",
                "capture_origin": "seed_csv",
            }
            for row in rows
        ]
        error_by_url: Dict[str, str] = {}
        imported_by_url: Dict[str, Dict[str, Any]] = {}
        try:
            result = await service.sync_agent_reach_posts(
                user_id=user_id,
                platforms=sorted({row["source_platform"] for row in rows}),
                source_items=batch_items,
            )
            for item in result.get("imported_sources") or []:
                url = str(item.get("canonical_url") or item.get("url") or "").strip()
                if url:
                    imported_by_url[url] = item
            for item in result.get("errors") or []:
                url = str(item.get("url") or "").strip()
                if url:
                    error_by_url[url] = str(item.get("error") or "import_failed")[:500]
        except Exception as exc:  # noqa: BLE001
            logger.warning("Seed hydration batch failed for %s: %s", job_id, exc)
            for row in rows:
                await pool.execute(
                    "UPDATE public.omnisave_seed_import_items SET status = 'failed', last_error = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
                    str(exc)[:500],
                    row["id"],
                    user_uuid,
                )
            await self._refresh_job(pool, job_uuid, user_uuid)
            return await self.get_job(user_id, job_id)
        for row in rows:
            url = row["source_url"]
            imported = imported_by_url.get(url)
            if imported is not None:
                await pool.execute(
                    """
                    UPDATE public.omnisave_seed_import_items
                    SET status = 'imported', source_id = $1, last_error = NULL, updated_at = NOW()
                    WHERE id = $2 AND user_id = $3
                    """,
                    uuid.UUID(imported["id"]) if imported.get("id") else None,
                    row["id"],
                    user_uuid,
                )
            elif url in error_by_url:
                await pool.execute(
                    "UPDATE public.omnisave_seed_import_items SET status = 'failed', last_error = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
                    error_by_url[url],
                    row["id"],
                    user_uuid,
                )
            else:
                await pool.execute(
                    "UPDATE public.omnisave_seed_import_items SET status = 'skipped', source_id = NULL, last_error = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2",
                    row["id"],
                    user_uuid,
                )
        await self._refresh_job(pool, job_uuid, user_uuid)
        return await self.get_job(user_id, job_id)

    async def _refresh_job(self, pool: Any, job_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await pool.execute(
            """
            UPDATE public.omnisave_seed_import_jobs AS job
            SET hydrated_count = counts.hydrated_count,
                imported_count = counts.imported_count,
                skipped_count = counts.skipped_count,
                failed_count = counts.failed_count,
                next_cursor = counts.hydrated_count,
                status = CASE
                    WHEN counts.pending_count = 0 AND counts.failed_count = 0 THEN 'completed'
                    WHEN counts.pending_count = 0 THEN 'partial'
                    ELSE 'running'
                END,
                completed_at = CASE WHEN counts.pending_count = 0 THEN COALESCE(job.completed_at, NOW()) ELSE NULL END,
                updated_at = NOW()
            FROM (
                SELECT
                    COUNT(*) FILTER (WHERE status IN ('imported', 'skipped', 'failed'))::int AS hydrated_count,
                    COUNT(*) FILTER (WHERE status = 'imported')::int AS imported_count,
                    COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped_count,
                    COUNT(*) FILTER (WHERE status = 'failed' AND attempts >= 3)::int AS failed_count,
                    COUNT(*) FILTER (
                        WHERE status IN ('pending')
                           OR (status = 'failed' AND attempts < 3)
                           OR (status = 'running' AND updated_at >= NOW() - INTERVAL '5 minutes')
                    )::int AS pending_count
                FROM public.omnisave_seed_import_items
                WHERE job_id = $1 AND user_id = $2
            ) AS counts
            WHERE job.id = $1 AND job.user_id = $2
            """,
            job_id,
            user_id,
        )

    @staticmethod
    def _serialise_job(row: Any) -> Dict[str, Any]:
        def iso(value: Any) -> Optional[str]:
            return value.isoformat() if hasattr(value, "isoformat") else value
        return {
            "id": str(row["id"]),
            "file_name": row["file_name"],
            "source_platform": row["source_platform"],
            "status": row["status"],
            "total_count": row["total_count"],
            "hydrated_count": row["hydrated_count"],
            "imported_count": row["imported_count"],
            "skipped_count": row["skipped_count"],
            "failed_count": row["failed_count"],
            "next_cursor": row["next_cursor"],
            "last_error": row["last_error"],
            "created_at": iso(row["created_at"]),
            "updated_at": iso(row["updated_at"]),
            "completed_at": iso(row["completed_at"]),
        }


_store: Optional[OmniSaveSeedStore] = None


def get_omnisave_seed_store() -> OmniSaveSeedStore:
    global _store
    if _store is None:
        _store = OmniSaveSeedStore()
    return _store
