"""Compose a token-budgeted memory context string for agent prompts.

Per TAYARI_MEMORY_LAYER_DESIGN §3.3, memory is prioritized across four tiers,
most actionable first, then truncated to a character budget so the injected
context never blows the model's prompt window:

    1. working    — current conversation's recent messages (most salient now)
    2. procedural — user preference profile (preferred roles/companies/counts)
    3. episodic   — recent feedback events (liked/applied/skipped signals)
    4. semantic   — embedding-similar past docs (resume/job snippets)

Each tier is fetched best-effort and degrades to empty when the DB or embedding
service is unavailable. The composer never raises — callers get a string they
can concatenate to their prompt unconditionally.

SRP: this module only composes; it owns no storage (reuses db helpers +
embedding_storage.find_similar + the user_preference_summary matview).
DIP: depends on the get_pool abstraction, not a concrete client.
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from typing import Any, Optional

from app.services.db import get_pool

logger = logging.getLogger(__name__)

# ponytail: char-budget not token-budget — a tight upper bound that's trivial to
# compute without a tokenizer. ~4 chars/token → ~2k tokens max. Tighten if a
# real tokenizer is wired in.
DEFAULT_CONTEXT_CHAR_BUDGET = 8000
WORKING_MESSAGE_WINDOW = 6
EPISODIC_EVENT_WINDOW = 8
SEMANTIC_RESULT_LIMIT = 5
SEMANTIC_MIN_SIMILARITY = 0.6

PENDING_SUMMARY_MARKER = "[PENDING_SUMMARIZATION]"


@dataclass(frozen=True)
class MemorySnapshot:
    """Prompt-ready memory plus safe provenance for user-facing traces."""

    context: str
    tiers_used: tuple[str, ...]
    truncated: bool
    char_budget: int


async def _fetch_working(user_id: str, conversation_id: Optional[str]) -> str:
    """Current conversation recent messages, or summary if already summarized."""
    if not conversation_id:
        return ""
    pool = await get_pool()
    if not pool:
        return ""
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT summary, messages FROM conversations WHERE id = $1::uuid AND user_id = $2::uuid",
                uuid.UUID(conversation_id),
                uuid.UUID(user_id),
            )
        if not row:
            return ""
        summary = row.get("summary")
        if summary and summary != PENDING_SUMMARY_MARKER:
            return f"[conversation summary] {summary}"
        msgs = row.get("messages") or []
        if isinstance(msgs, str):
            msgs = json.loads(msgs)
        recent = msgs[-WORKING_MESSAGE_WINDOW:]
        joined = " | ".join(f"{m.get('role', '?')}: {str(m.get('content', ''))[:120]}" for m in recent)
        return f"[recent conversation] {joined}" if joined else ""
    except Exception as exc:  # noqa: BLE001
        logger.debug("memory_composer working tier failed: %s", exc)
        return ""


async def _fetch_procedural(user_id: str) -> str:
    """User preference profile from the user_preference_summary materialized view."""
    pool = await get_pool()
    if not pool:
        return ""
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT preferred_titles, preferred_companies, liked_count, applied_count, skipped_count "
                "FROM user_preference_summary WHERE user_id = $1::uuid",
                uuid.UUID(user_id),
            )
        if not row:
            return ""
        titles = row.get("preferred_titles") or []
        companies = row.get("preferred_companies") or []
        parts = ["[user preferences]"]
        if titles:
            parts.append(f"preferred roles: {', '.join(t for t in titles if t)[:200]}")
        if companies:
            parts.append(f"preferred companies: {', '.join(c for c in companies if c)[:200]}")
        parts.append(f"liked={row.get('liked_count') or 0} applied={row.get('applied_count') or 0} skipped={row.get('skipped_count') or 0}")
        return " | ".join(parts)
    except Exception as exc:  # noqa: BLE001
        logger.debug("memory_composer procedural tier failed: %s", exc)
        return ""


async def _fetch_episodic(user_id: str) -> str:
    """Recent feedback signals (liked / applied / skipped) as episodic memory."""
    pool = await get_pool()
    if not pool:
        return ""
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT job_title, company_name, feedback_type
                FROM user_job_feedback
                WHERE user_id = $1::uuid
                ORDER BY created_at DESC
                LIMIT $2
                """,
                uuid.UUID(user_id),
                EPISODIC_EVENT_WINDOW,
            )
        if not rows:
            return ""
        signals = []
        for r in rows:
            label = r.get("job_title") or r.get("company_name") or "a role"
            signals.append(f"{r['feedback_type']}: {label}")
        return f"[recent feedback] {' | '.join(signals)}"
    except Exception as exc:  # noqa: BLE101
        logger.debug("memory_composer episodic tier failed: %s", exc)
        return ""


async def _fetch_semantic(user_id: str, query: str) -> str:
    """Embedding-similar past docs (resume/job snippets) via pgvector."""
    if not query:
        return ""
    try:
        from app.services.embedding_storage import find_similar
        results = await find_similar(
            user_id=user_id,
            query_text=query,
            limit=SEMANTIC_RESULT_LIMIT,
            min_similarity=SEMANTIC_MIN_SIMILARITY,
        )
        if not results:
            return ""
        snippets = []
        for r in results:
            preview = (r.get("text_preview") or "").strip()
            if preview:
                snippets.append(f"({r.get('content_type', 'doc')}) {preview[:120]}")
        return f"[similar past docs] {' | '.join(snippets)}" if snippets else ""
    except Exception as exc:  # noqa: BLE001
        logger.debug("memory_composer semantic tier failed: %s", exc)
        return ""


async def compose_context_snapshot(
    user_id: Optional[str],
    query: str = "",
    conversation_id: Optional[str] = None,
    char_budget: int = DEFAULT_CONTEXT_CHAR_BUDGET,
) -> MemorySnapshot:
    """Compose prioritized memory and report which layers actually contributed.

    The context order is working → procedural → episodic → semantic. Storage or
    embedding failures degrade to an empty tier, while the snapshot makes that
    result visible to callers without exposing private memory contents.
    """
    if not user_id:
        return MemorySnapshot("", (), False, char_budget)

    tier_values: list[tuple[str, str]] = []
    working = await _fetch_working(user_id, conversation_id)
    if working:
        tier_values.append(("working", working))
    procedural = await _fetch_procedural(user_id)
    if procedural:
        tier_values.append(("procedural", procedural))
    episodic = await _fetch_episodic(user_id)
    if episodic:
        tier_values.append(("episodic", episodic))
    if query:
        semantic = await _fetch_semantic(user_id, query)
        if semantic:
            tier_values.append(("semantic", semantic))

    if not tier_values:
        return MemorySnapshot("", (), False, char_budget)

    composed = "\n".join(value for _, value in tier_values)
    context = _truncate_to_budget(composed, char_budget)
    return MemorySnapshot(
        context=context,
        tiers_used=tuple(name for name, _ in tier_values),
        truncated=len(context) < len(composed),
        char_budget=char_budget,
    )


async def compose_context(
    user_id: Optional[str],
    query: str = "",
    conversation_id: Optional[str] = None,
    char_budget: int = DEFAULT_CONTEXT_CHAR_BUDGET,
) -> str:
    """Return the existing string contract for prompt callers."""
    return (await compose_context_snapshot(
        user_id=user_id,
        query=query,
        conversation_id=conversation_id,
        char_budget=char_budget,
    )).context


def _truncate_to_budget(text: str, budget: int) -> str:
    """Truncate to ``budget`` chars on a word boundary, appending an ellipsis.

    ponytail: pure helper so the budget logic has a runnable self-check —
    compose_context itself is async+DB-bound and can't be exercised headless.
    """
    if len(text) <= budget:
        return text
    return text[:budget].rsplit(" ", 1)[0] + "…"


__all__ = ["MemorySnapshot", "compose_context", "compose_context_snapshot"]


if __name__ == "__main__":  # ponytail: self-check, no DB needed
    import asyncio

    assert _truncate_to_budget("short", 100) == "short"
    assert _truncate_to_budget("a b c d e", 5).endswith("…")
    assert _truncate_to_budget("a b c d e", 5).count(" ") <= 1  # word-boundary cut
    assert asyncio.run(compose_context(None)) == ""  # no user_id → empty, no DB
    print("memory_composer self-check OK")