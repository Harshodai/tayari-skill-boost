"""Persistence helpers for OmniSaveAI evidence cards and career context links."""
from __future__ import annotations

import uuid as uuid_lib
from typing import Any, Dict, List, Optional

from app.services.db import get_pool


_ALLOWED_CONTEXT_TYPES = {
    "role",
    "company",
    "skill",
    "application",
    "practice",
    "interview_stage",
}
_ALLOWED_ACTION_TYPES = {"evidence", "question", "flashcard", "application"}


def _row_to_highlight(row: Any) -> Dict[str, Any]:
    return {
        "id": str(row["id"]),
        "source_id": str(row["source_id"]),
        "user_id": str(row["user_id"]),
        "text_excerpt": row["text_excerpt"],
        "start_offset": row["start_offset"],
        "end_offset": row["end_offset"],
        "note": row["note"] or "",
        "color": row["color"] or "amber",
        "action_type": row["action_type"] or "evidence",
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _row_to_context(row: Any) -> Dict[str, Any]:
    return {
        "id": str(row["id"]),
        "source_id": str(row["source_id"]),
        "user_id": str(row["user_id"]),
        "context_type": row["context_type"],
        "context_id": row["context_id"],
        "context_label": row["context_label"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


class OmniSaveEvidenceStore:
    """Small asyncpg store with explicit owner predicates on every operation."""

    @staticmethod
    def _uuid(value: str) -> uuid_lib.UUID:
        return uuid_lib.UUID(str(value))

    @staticmethod
    def _validate_context(context_type: str, context_label: str) -> tuple[str, str]:
        normalized_type = context_type.strip().lower()
        normalized_label = " ".join(context_label.strip().split())
        if normalized_type not in _ALLOWED_CONTEXT_TYPES:
            raise ValueError("invalid_context_type")
        if not normalized_label or len(normalized_label) > 240:
            raise ValueError("invalid_context_label")
        return normalized_type, normalized_label

    @staticmethod
    def _validate_highlight(
        text_excerpt: str,
        note: str,
        color: str,
        action_type: str,
        start_offset: Optional[int],
        end_offset: Optional[int],
    ) -> tuple[str, str, str, str, Optional[int], Optional[int]]:
        excerpt = text_excerpt.strip()
        annotation = note.strip()
        normalized_color = color.strip().lower() or "amber"
        normalized_action = action_type.strip().lower() or "evidence"
        if not excerpt or len(excerpt) > 5000:
            raise ValueError("invalid_text_excerpt")
        if len(annotation) > 2000:
            raise ValueError("invalid_note")
        if normalized_action not in _ALLOWED_ACTION_TYPES:
            raise ValueError("invalid_action_type")
        if start_offset is not None and start_offset < 0:
            raise ValueError("invalid_start_offset")
        if end_offset is not None and end_offset < 0:
            raise ValueError("invalid_end_offset")
        if start_offset is not None and end_offset is not None and end_offset < start_offset:
            raise ValueError("invalid_offsets")
        return excerpt, annotation, normalized_color, normalized_action, start_offset, end_offset

    async def _pool(self) -> Any:
        pool = await get_pool()
        if pool is None:
            raise RuntimeError("knowledge_store_unavailable")
        return pool

    async def create_highlight(
        self,
        user_id: str,
        source_id: str,
        *,
        text_excerpt: str,
        note: str = "",
        color: str = "amber",
        action_type: str = "evidence",
        start_offset: Optional[int] = None,
        end_offset: Optional[int] = None,
    ) -> Dict[str, Any]:
        excerpt, annotation, normalized_color, normalized_action, start, end = self._validate_highlight(
            text_excerpt, note, color, action_type, start_offset, end_offset
        )
        user_uuid = self._uuid(user_id)
        source_uuid = self._uuid(source_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            owned = await conn.fetchval(
                "SELECT id FROM public.saved_sources WHERE id = $1 AND user_id = $2",
                source_uuid,
                user_uuid,
            )
            if owned is None:
                raise LookupError("source_not_found")
            row = await conn.fetchrow(
                """
                INSERT INTO public.source_highlights
                    (source_id, user_id, text_excerpt, start_offset, end_offset, note, color, action_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
                """,
                source_uuid,
                user_uuid,
                excerpt,
                start,
                end,
                annotation,
                normalized_color,
                normalized_action,
            )
        return _row_to_highlight(row)

    async def list_highlights(self, user_id: str, source_id: str) -> List[Dict[str, Any]]:
        user_uuid = self._uuid(user_id)
        source_uuid = self._uuid(source_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT h.*
                FROM public.source_highlights h
                JOIN public.saved_sources s ON s.id = h.source_id AND s.user_id = h.user_id
                WHERE h.user_id = $1 AND h.source_id = $2
                ORDER BY h.created_at DESC
                """,
                user_uuid,
                source_uuid,
            )
        return [_row_to_highlight(row) for row in rows]

    async def delete_highlight(self, user_id: str, source_id: str, highlight_id: str) -> bool:
        user_uuid = self._uuid(user_id)
        source_uuid = self._uuid(source_id)
        highlight_uuid = self._uuid(highlight_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            deleted = await conn.fetchval(
                """
                DELETE FROM public.source_highlights
                WHERE id = $1 AND source_id = $2 AND user_id = $3
                RETURNING id
                """,
                highlight_uuid,
                source_uuid,
                user_uuid,
            )
        return deleted is not None

    async def link_context(
        self,
        user_id: str,
        source_id: str,
        *,
        context_type: str,
        context_label: str,
        context_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        normalized_type, normalized_label = self._validate_context(context_type, context_label)
        user_uuid = self._uuid(user_id)
        source_uuid = self._uuid(source_id)
        normalized_id = context_id.strip()[:128] if context_id else None
        pool = await self._pool()
        async with pool.acquire() as conn:
            owned = await conn.fetchval(
                "SELECT id FROM public.saved_sources WHERE id = $1 AND user_id = $2",
                source_uuid,
                user_uuid,
            )
            if owned is None:
                raise LookupError("source_not_found")
            await conn.execute(
                """
                INSERT INTO public.source_context_links
                    (source_id, user_id, context_type, context_id, context_label)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT DO NOTHING
                """,
                source_uuid,
                user_uuid,
                normalized_type,
                normalized_id,
                normalized_label,
            )
            row = await conn.fetchrow(
                """
                SELECT *
                FROM public.source_context_links
                WHERE source_id = $1 AND user_id = $2 AND context_type = $3
                  AND COALESCE(context_id, '') = COALESCE($4, '')
                  AND lower(context_label) = lower($5)
                LIMIT 1
                """,
                source_uuid,
                user_uuid,
                normalized_type,
                normalized_id,
                normalized_label,
            )
        return _row_to_context(row)

    async def list_context_links(self, user_id: str, source_id: str) -> List[Dict[str, Any]]:
        user_uuid = self._uuid(user_id)
        source_uuid = self._uuid(source_id)
        pool = await self._pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT l.*
                FROM public.source_context_links l
                JOIN public.saved_sources s ON s.id = l.source_id AND s.user_id = l.user_id
                WHERE l.user_id = $1 AND l.source_id = $2
                ORDER BY l.context_type, lower(l.context_label)
                """,
                user_uuid,
                source_uuid,
            )
        return [_row_to_context(row) for row in rows]

    async def context_graph(
        self,
        user_id: str,
        *,
        skill: Optional[str] = None,
        role: Optional[str] = None,
    ) -> Dict[str, Any]:
        user_uuid = self._uuid(user_id)
        skill_filter = skill.strip() if skill and skill.strip() else None
        role_filter = role.strip() if role and role.strip() else None
        pool = await self._pool()
        async with pool.acquire() as conn:
            source_rows = await conn.fetch(
                """
                SELECT s.id, s.title, s.author, s.source_platform, s.canonical_url,
                       s.primary_category, s.secondary_tags, s.nlp_metadata,
                       s.created_at,
                       (SELECT count(*) FROM public.source_highlights h
                        WHERE h.source_id = s.id AND h.user_id = s.user_id) AS highlight_count
                FROM public.saved_sources s
                WHERE s.user_id = $1
                  AND ($2::text IS NULL OR EXISTS (
                      SELECT 1 FROM public.source_context_links ls
                      WHERE ls.source_id = s.id AND ls.user_id = s.user_id
                        AND ls.context_type = 'skill'
                        AND ls.context_label ILIKE '%' || $2 || '%'
                  ))
                  AND ($3::text IS NULL OR EXISTS (
                      SELECT 1 FROM public.source_context_links lr
                      WHERE lr.source_id = s.id AND lr.user_id = s.user_id
                        AND lr.context_type = 'role'
                        AND lr.context_label ILIKE '%' || $3 || '%'
                  ))
                ORDER BY s.created_at DESC
                LIMIT 250
                """,
                user_uuid,
                skill_filter,
                role_filter,
            )
            source_ids = [row["id"] for row in source_rows]
            if not source_ids:
                return {
                    "filters": {"skill": skill_filter, "role": role_filter},
                    "sources": [],
                    "highlights": [],
                    "questions": [],
                    "practice_sessions": [],
                    "nodes": [],
                    "edges": [],
                }
            links = await conn.fetch(
                """
                SELECT * FROM public.source_context_links
                WHERE user_id = $1 AND source_id = ANY($2::uuid[])
                ORDER BY context_type, lower(context_label)
                """,
                user_uuid,
                source_ids,
            )
            highlights = await conn.fetch(
                """
                SELECT * FROM public.source_highlights
                WHERE user_id = $1 AND source_id = ANY($2::uuid[])
                ORDER BY created_at DESC
                """,
                user_uuid,
                source_ids,
            )

        source_items = [
            {
                "id": str(row["id"]),
                "title": row["title"],
                "author": row["author"],
                "platform": row["source_platform"],
                "url": row["canonical_url"],
                "category": row["primary_category"],
                "tags": row["secondary_tags"] or [],
                "nlp": row["nlp_metadata"] or {},
                "saved_at": row["created_at"].isoformat() if row["created_at"] else None,
                "highlight_count": int(row["highlight_count"] or 0),
            }
            for row in source_rows
        ]
        link_items = [_row_to_context(row) for row in links]
        highlight_items = [_row_to_highlight(row) for row in highlights]
        question_items = [item for item in highlight_items if item["action_type"] == "question"]
        context_by_key: Dict[str, Dict[str, Any]] = {}
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []
        for source in source_items:
            node_id = f"source:{source['id']}"
            nodes.append({"id": node_id, "type": "source", "label": source["title"], "source": source})
        for link in link_items:
            context_key = f"{link['context_type']}:{link['context_id'] or link['context_label'].lower()}"
            if context_key not in context_by_key:
                context_by_key[context_key] = link
                nodes.append({
                    "id": f"context:{context_key}",
                    "type": link["context_type"],
                    "label": link["context_label"],
                })
            edges.append({
                "source": f"source:{link['source_id']}",
                "target": f"context:{context_key}",
                "type": link["context_type"],
            })
        return {
            "filters": {"skill": skill_filter, "role": role_filter},
            "sources": source_items,
            "context_links": link_items,
            "highlights": highlight_items,
            "questions": question_items,
            "practice_sessions": [],
            "nodes": nodes,
            "edges": edges,
        }


_evidence_store = OmniSaveEvidenceStore()


def get_omnisave_evidence_store() -> OmniSaveEvidenceStore:
    return _evidence_store
