"""Conversations CRUD + message append for the persistent memory layer.

Routes (all under ``/api/v1/conversations``, all require ``X-User-Id``):

- ``POST   /``            — create a conversation, returns id + row.
- ``GET    /``            — list a user's conversations (newest first, non-archived).
- ``GET    /{conv_id}``   — fetch one conversation with full message history.
- ``POST   /{conv_id}/messages`` — append a message + update updated_at.
- ``PATCH  /{conv_id}``   — update title / archive flag / context_type.
- ``DELETE /{conv_id}``   — soft or hard delete (hard via CASCADE).

Degrades to 503 when the DB pool is unavailable (matches hermes/career-ops
convention). Uses the existing ``conversations`` table from migration
``20260629000001_add_conversations.sql`` — no new table.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import Depends, APIRouter, HTTPException, Header, Body
from app.auth.dependencies import get_current_user
from pydantic import BaseModel, Field

from app.services.db import get_pool

logger = logging.getLogger(__name__)

conversation_router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])

# ponytail: message cap is the same threshold the DB trigger uses to mark a
# conversation for summarization (maybe_summarize_conversation). Keep in one
# constant so frontend + backend agree without a shared schema import.
SUMMARIZE_THRESHOLD = 20
MAX_LIST_LIMIT = 50
DEFAULT_LIST_LIMIT = 20


def _require_user(x_user_id: Optional[str]) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header is required")
    return x_user_id


def _no_db() -> None:
    raise HTTPException(status_code=503, detail="Memory store unavailable (DB disabled)")


# ---------------------------------------------------------------------------
# Models (ISP — one focused model per request shape)
# ---------------------------------------------------------------------------

class Message(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str
    timestamp: Optional[str] = None


class ConversationCreate(BaseModel):
    title: Optional[str] = None
    context_type: str = "general"
    related_job_id: Optional[str] = None
    messages: List[Message] = Field(default_factory=list)


class MessageAppend(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str
    timestamp: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    context_type: Optional[str] = None
    is_archived: Optional[bool] = None


class ConversationResponse(BaseModel):
    id: str
    user_id: str
    title: Optional[str] = None
    messages: List[dict] = Field(default_factory=list)
    summary: Optional[str] = None
    context_type: str = "general"
    related_job_id: Optional[str] = None
    is_archived: bool = False
    created_at: str
    updated_at: str


def _row_to_response(row: dict) -> ConversationResponse:
    msgs = row.get("messages")
    if isinstance(msgs, str):
        msgs = json.loads(msgs)
    return ConversationResponse(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        title=row.get("title"),
        messages=msgs or [],
        summary=row.get("summary"),
        context_type=row.get("context_type") or "general",
        related_job_id=str(row["related_job_id"]) if row.get("related_job_id") else None,
        is_archived=bool(row.get("is_archived", False)),
        created_at=row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
        updated_at=row["updated_at"].isoformat() if hasattr(row["updated_at"], "isoformat") else str(row["updated_at"]),
    )


@conversation_router.post("", response_model=ConversationResponse)
async def create_conversation(
    payload: ConversationCreate,
    x_user_id: str = Depends(get_current_user),
) -> ConversationResponse:
    user_id = _require_user(x_user_id)
    pool = await get_pool()
    if not pool:
        _no_db()
    import asyncpg  # noqa: F401 — type guard only
    msgs = [m.model_dump(mode="json") for m in payload.messages]
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO conversations (user_id, title, messages, context_type, related_job_id)
                VALUES ($1, $2, $3::jsonb, $4, $5::uuid)
                RETURNING *
                """,
                uuid.UUID(user_id),
                payload.title,
                json.dumps(msgs),
                payload.context_type,
                uuid.UUID(payload.related_job_id) if payload.related_job_id else None,
            )
        return _row_to_response(dict(row))
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("create_conversation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create conversation")


@conversation_router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    x_user_id: str = Depends(get_current_user),
    limit: int = DEFAULT_LIST_LIMIT,
) -> List[ConversationResponse]:
    user_id = _require_user(x_user_id)
    pool = await get_pool()
    if not pool:
        _no_db()
    limit = min(max(1, limit), MAX_LIST_LIMIT)
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM conversations
                WHERE user_id = $1 AND is_archived = FALSE
                ORDER BY updated_at DESC
                LIMIT $2
                """,
                uuid.UUID(user_id),
                limit,
            )
        return [_row_to_response(dict(r)) for r in rows]
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("list_conversations failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to list conversations")


@conversation_router.get("/{conv_id}", response_model=ConversationResponse)
async def get_conversation(
    conv_id: str,
    x_user_id: str = Depends(get_current_user),
) -> ConversationResponse:
    user_id = _require_user(x_user_id)
    pool = await get_pool()
    if not pool:
        _no_db()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM conversations WHERE id = $1::uuid AND user_id = $2::uuid",
                uuid.UUID(conv_id),
                uuid.UUID(user_id),
            )
        if not row:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return _row_to_response(dict(row))
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("get_conversation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch conversation")


@conversation_router.post("/{conv_id}/messages", response_model=ConversationResponse)
async def append_message(
    conv_id: str,
    payload: MessageAppend,
    x_user_id: str = Depends(get_current_user),
) -> ConversationResponse:
    user_id = _require_user(x_user_id)
    pool = await get_pool()
    if not pool:
        _no_db()
    entry = {
        "role": payload.role,
        "content": payload.content,
        "timestamp": payload.timestamp or datetime.now(timezone.utc).isoformat(),
    }
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE conversations
                SET messages = messages || $3::jsonb,
                    updated_at = NOW()
                WHERE id = $1::uuid AND user_id = $2::uuid
                RETURNING *
                """,
                uuid.UUID(conv_id),
                uuid.UUID(user_id),
                json.dumps([entry]),
            )
        if not row:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return _row_to_response(dict(row))
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("append_message failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to append message")


@conversation_router.patch("/{conv_id}", response_model=ConversationResponse)
async def update_conversation(
    conv_id: str,
    payload: ConversationUpdate,
    x_user_id: str = Depends(get_current_user),
) -> ConversationResponse:
    user_id = _require_user(x_user_id)
    pool = await get_pool()
    if not pool:
        _no_db()
    sets: list[str] = []
    args: list = [uuid.UUID(conv_id), uuid.UUID(user_id)]
    idx = 3
    for field in ("title", "context_type", "is_archived"):
        val = getattr(payload, field)
        if val is not None:
            sets.append(f"{field} = ${idx}")
            args.append(val)
            idx += 1
    if not sets:
        raise HTTPException(status_code=400, detail="No updatable fields supplied")
    sets.append("updated_at = NOW()")
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"UPDATE conversations SET {', '.join(sets)} WHERE id = $1::uuid AND user_id = $2::uuid RETURNING *",
                *args,
            )
        if not row:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return _row_to_response(dict(row))
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("update_conversation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to update conversation")


@conversation_router.delete("/{conv_id}")
async def delete_conversation(
    conv_id: str,
    x_user_id: str = Depends(get_current_user),
) -> dict:
    user_id = _require_user(x_user_id)
    pool = await get_pool()
    if not pool:
        _no_db()
    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM conversations WHERE id = $1::uuid AND user_id = $2::uuid",
                uuid.UUID(conv_id),
                uuid.UUID(user_id),
            )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("delete_conversation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to delete conversation")