"""Durable automatic-sync settings, run history, and OmniSaveAI exports."""
from __future__ import annotations

import json
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from app.services.db import get_pool

SUPPORTED_PLATFORMS = ("linkedin", "medium", "substack", "instagram")
DEFAULT_PLATFORMS = list(SUPPORTED_PLATFORMS)
MAX_EXPORT_SOURCES = 500
MAX_SOURCE_TEXT_CHARS = 100_000


def _json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except (TypeError, ValueError):
            return {}
    return {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_iso(value: Any) -> Optional[str]:
    return value.isoformat() if value else None


def _truncate_text(value: Any, limit: int = MAX_SOURCE_TEXT_CHARS) -> Optional[str]:
    """Cap an export text field so a single huge source cannot balloon a bundle."""
    if not value:
        return value
    text = str(value)
    if len(text) <= limit:
        return text
    return text[:limit] + "\n[truncated]"


def _normalise_platforms(platforms: Optional[Iterable[str]]) -> List[str]:
    values = platforms if platforms is not None else DEFAULT_PLATFORMS
    result: List[str] = []
    for value in values:
        platform = str(value).strip().lower()
        if platform in SUPPORTED_PLATFORMS and platform not in result:
            result.append(platform)
    return result or list(DEFAULT_PLATFORMS)


def _settings(row: Any, user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "enabled": bool(row["enabled"]) if row else False,
        "platforms": list(row["platforms"] or DEFAULT_PLATFORMS) if row else list(DEFAULT_PLATFORMS),
        "interval_minutes": int(row["interval_minutes"] or 60) if row else 60,
        "last_started_at": _as_iso(row["last_started_at"]) if row else None,
        "last_completed_at": _as_iso(row["last_completed_at"]) if row else None,
        "last_status": row["last_status"] if row else "never",
        "last_error": row["last_error"] if row else None,
        "updated_at": _as_iso(row["updated_at"]) if row else None,
    }


def calculate_freshness_score(row: Any) -> int:
    """Return a deterministic 0-100 freshness score for review ordering."""
    now = datetime.now(timezone.utc)
    seen = row.get("last_seen_at") or row.get("created_at")
    if seen is None:
        age_days = 365
    else:
        if seen.tzinfo is None:
            seen = seen.replace(tzinfo=timezone.utc)
        age_days = max(0, (now - seen).days)
    score = max(0, 100 - min(100, age_days * 3))
    status = str(row.get("sync_status") or "").lower()
    if status in {"failed", "blocked", "error"}:
        score = max(0, score - 35)
    elif status in {"pending", "running"}:
        score = max(0, score - 10)
    return int(score)


class OmniSaveSyncStore:
    async def _pool(self) -> Any:
        pool = await get_pool()
        if pool is None:
            raise RuntimeError("knowledge_store_unavailable")
        return pool

    async def get_settings(self, user_id: str) -> Dict[str, Any]:
        user_uuid = uuid_lib.UUID(user_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM public.omnisave_sync_settings WHERE user_id = $1",
                user_uuid,
            )
        return _settings(row, user_id)

    async def update_settings(
        self,
        user_id: str,
        *,
        enabled: bool,
        platforms: Optional[Iterable[str]] = None,
        interval_minutes: int = 60,
    ) -> Dict[str, Any]:
        if interval_minutes < 5 or interval_minutes > 1440:
            raise ValueError("invalid_interval_minutes")
        user_uuid = uuid_lib.UUID(user_id)
        selected_platforms = _normalise_platforms(platforms)
        pool = await self._pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO public.omnisave_sync_settings
                    (user_id, enabled, platforms, interval_minutes, last_status)
                VALUES ($1, $2, $3, $4, CASE WHEN $2 THEN 'never' ELSE 'paused' END)
                ON CONFLICT (user_id) DO UPDATE SET
                    enabled = EXCLUDED.enabled,
                    platforms = EXCLUDED.platforms,
                    interval_minutes = EXCLUDED.interval_minutes,
                    last_status = CASE WHEN EXCLUDED.enabled THEN
                        CASE WHEN public.omnisave_sync_settings.last_status = 'paused' THEN 'never'
                             ELSE public.omnisave_sync_settings.last_status END
                        ELSE 'paused' END,
                    updated_at = NOW()
                RETURNING *
                """,
                user_uuid,
                bool(enabled),
                selected_platforms,
                interval_minutes,
            )
        return _settings(row, user_id)

    async def start_run(self, user_id: str, trigger_type: str, requested_count: int) -> str:
        if trigger_type not in {"manual", "automatic", "import", "extension"}:
            raise ValueError("invalid_trigger_type")
        user_uuid = uuid_lib.UUID(user_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            run_id = await conn.fetchval(
                """
                INSERT INTO public.omnisave_sync_runs (user_id, trigger_type, requested_count)
                VALUES ($1, $2, $3)
                RETURNING id
                """,
                user_uuid,
                trigger_type,
                max(0, requested_count),
            )
            await conn.execute(
                """
                INSERT INTO public.omnisave_sync_settings (user_id, last_started_at, last_status)
                VALUES ($1, NOW(), 'running')
                ON CONFLICT (user_id) DO UPDATE SET
                    last_started_at = NOW(), last_status = 'running', last_error = NULL, updated_at = NOW()
                """,
                user_uuid,
            )
        return str(run_id)

    async def finish_run(
        self,
        user_id: str,
        run_id: str,
        *,
        status: str,
        imported_count: int,
        skipped_count: int,
        failed_count: int,
        errors: List[Dict[str, Any]],
    ) -> None:
        if status not in {"completed", "partial", "failed"}:
            raise ValueError("invalid_run_status")
        user_uuid = uuid_lib.UUID(user_id)
        run_uuid = uuid_lib.UUID(run_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE public.omnisave_sync_runs
                SET status = $1, imported_count = $2, skipped_count = $3,
                    failed_count = $4, errors = $5::jsonb, completed_at = NOW()
                WHERE id = $6 AND user_id = $7
                """,
                status,
                max(0, imported_count),
                max(0, skipped_count),
                max(0, failed_count),
                json.dumps(errors[:50]),
                run_uuid,
                user_uuid,
            )
            await conn.execute(
                """
                UPDATE public.omnisave_sync_settings
                SET last_completed_at = NOW(), last_status = $1,
                    last_error = $2, updated_at = NOW()
                WHERE user_id = $3
                """,
                status,
                (errors[0].get("error") if errors else None),
                user_uuid,
            )

    async def list_runs(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        user_uuid = uuid_lib.UUID(user_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, trigger_type, status, requested_count, imported_count,
                       skipped_count, failed_count, errors, started_at, completed_at
                FROM public.omnisave_sync_runs
                WHERE user_id = $1
                ORDER BY started_at DESC
                LIMIT $2
                """,
                user_uuid,
                max(1, min(limit, 100)),
            )
        return [
            {
                "id": str(row["id"]),
                "trigger_type": row["trigger_type"],
                "status": row["status"],
                "requested_count": row["requested_count"],
                "imported_count": row["imported_count"],
                "skipped_count": row["skipped_count"],
                "failed_count": row["failed_count"],
                "errors": row["errors"] or [],
                "started_at": _as_iso(row["started_at"]),
                "completed_at": _as_iso(row["completed_at"]),
            }
            for row in rows
        ]

    @staticmethod
    def _freshness_score(row: Any) -> int:
        return calculate_freshness_score(row)


    async def export_bundle(self, user_id: str) -> Dict[str, Any]:
        user_uuid = uuid_lib.UUID(user_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            sources = await conn.fetch(
                """
                SELECT id, source_platform, canonical_url, title, author,
                       publication_name, raw_content, clean_markdown,
                       primary_category, secondary_tags, summary_bullets,
                       nlp_metadata, saved_at, created_at,
                       p.capture_origin, p.sync_status, p.first_captured_at,
                       p.last_seen_at, p.last_attempt_at, p.attempt_count, p.last_error
                FROM public.saved_sources
                LEFT JOIN public.omnisave_source_provenance p ON p.source_id = saved_sources.id AND p.user_id = saved_sources.user_id
                WHERE saved_sources.user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                user_uuid,
                MAX_EXPORT_SOURCES,
            )
            source_ids = [row["id"] for row in sources]
            highlights = []
            contexts = []
            if source_ids:
                highlights = await conn.fetch(
                    "SELECT * FROM public.source_highlights WHERE user_id = $1 AND source_id = ANY($2::uuid[]) ORDER BY created_at DESC",
                    user_uuid,
                    source_ids,
                )
                contexts = await conn.fetch(
                    "SELECT * FROM public.source_context_links WHERE user_id = $1 AND source_id = ANY($2::uuid[]) ORDER BY created_at DESC",
                    user_uuid,
                    source_ids,
                )
        source_map = {
            str(row["id"]): {
                "id": str(row["id"]),
                "platform": row["source_platform"],
                "url": row["canonical_url"],
                "title": row["title"],
                "author": row["author"],
                "publication_name": row["publication_name"],
                "raw_content": _truncate_text(row["raw_content"]),
                "clean_markdown": _truncate_text(row["clean_markdown"]),
                "category": row["primary_category"],
                "tags": row["secondary_tags"] or [],
                "summary": row["summary_bullets"] or [],
                "nlp": _json_object(row["nlp_metadata"]),
                "media": _json_object(row["nlp_metadata"]).get("media") or [],
                "saved_at": _as_iso(row["saved_at"] or row["created_at"]),
                "capture_origin": row.get("capture_origin"),
                "sync_status": row.get("sync_status"),
                "first_captured_at": _as_iso(row.get("first_captured_at")),
                "last_seen_at": _as_iso(row.get("last_seen_at")),
                "last_attempt_at": _as_iso(row.get("last_attempt_at")),
                "attempt_count": int(row.get("attempt_count", 0) or 0),
                "last_sync_error": row.get("last_error"),
                "thread_context": _json_object(row.get("nlp_metadata")).get("thread_context"),
                "freshness_score": self._freshness_score(row),
                "highlights": [],
                "context_links": [],
            }
            for row in sources
        }
        for row in highlights:
            source_map[str(row["source_id"])]["highlights"].append({
                "id": str(row["id"]),
                "excerpt": row["text_excerpt"],
                "note": row["note"] or "",
                "color": row["color"],
                "action_type": row["action_type"],
                "created_at": _as_iso(row["created_at"]),
            })
        for row in contexts:
            source_map[str(row["source_id"])]["context_links"].append({
                "id": str(row["id"]),
                "context_type": row["context_type"],
                "context_id": row["context_id"],
                "context_label": row["context_label"],
                "created_at": _as_iso(row["created_at"]),
            })
        return {
            "schema_version": "omnisave-export-v1",
            "exported_at": _now().isoformat(),
            "source_count": len(source_map),
            "sources": list(source_map.values()),
        }


_sync_store = OmniSaveSyncStore()


def get_omnisave_sync_store() -> OmniSaveSyncStore:
    return _sync_store
