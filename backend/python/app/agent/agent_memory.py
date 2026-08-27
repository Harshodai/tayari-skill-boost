"""Bounded agent memory with durable owner-scoped persistence when a DB is available."""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from app.services.db import get_pool

logger = logging.getLogger(__name__)
_MAX_EPISODES = 50
_MAX_REFLECTIONS = 50
_MAX_VALUE_BYTES = 12000


class AgentMemory:
    """Keep execution memory bounded locally and persist it per authenticated owner."""

    def __init__(self, user_id: str | None = None):
        self.user_id = user_id
        self.episodic_memory: List[Dict[str, Any]] = []
        self.semantic_memory: Dict[str, Any] = {}
        self.reflections: List[Dict[str, Any]] = []
        self.persistence_status = "not_requested" if not user_id else "pending"
        self.persistence_error: str | None = None
        self._pending: list[tuple[str, str, Any]] = []

    async def load(self) -> dict[str, Any]:
        if not self.user_id:
            self.persistence_status = "not_requested"
            return {"status": self.persistence_status, "loaded": 0}
        pool = await get_pool()
        if not pool:
            self.persistence_status = "unavailable"
            self.persistence_error = "database pool unavailable"
            return {"status": self.persistence_status, "loaded": 0, "error": self.persistence_error}
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT memory_type, memory_key, payload
                    FROM agent_memories
                    WHERE user_id=$1
                    ORDER BY updated_at DESC
                    LIMIT 150
                    """,
                    self.user_id,
                )
            for row in rows:
                payload = row["payload"]
                if isinstance(payload, str):
                    payload = json.loads(payload)
                memory_type = row["memory_type"]
                if memory_type == "semantic":
                    self.semantic_memory[row["memory_key"]] = payload.get("value") if isinstance(payload, dict) else payload
                elif memory_type == "episodic" and isinstance(payload, dict):
                    self.episodic_memory.extend(payload.get("items", []))
                elif memory_type == "reflection" and isinstance(payload, dict):
                    self.reflections.extend(payload.get("items", []))
            self.episodic_memory = self.episodic_memory[-_MAX_EPISODES:]
            self.reflections = self.reflections[-_MAX_REFLECTIONS:]
            self.persistence_status = "loaded"
            return {"status": self.persistence_status, "loaded": len(rows)}
        except Exception as exc:  # noqa: BLE001 - surface truthful degraded state
            self.persistence_status = "failed"
            self.persistence_error = type(exc).__name__
            logger.warning("agent memory load failed: %s", exc)
            return {"status": self.persistence_status, "loaded": 0, "error": self.persistence_error}

    def _queue(self, memory_type: str, key: str, payload: Any) -> None:
        if not self.user_id:
            return
        encoded = json.dumps(payload, ensure_ascii=False, default=str, separators=(",", ":"))
        if len(encoded) > _MAX_VALUE_BYTES:
            bounded_payload: Any = {
                "truncated": True,
                "preview": encoded[: _MAX_VALUE_BYTES - 64],
                "original_bytes": len(encoded),
            }
        else:
            bounded_payload = json.loads(encoded)
        self._pending.append((memory_type, key[:240], bounded_payload))

    def record_episode(self, step: int, action: str, code: Optional[str], result: Any, success: bool):
        episode = {
            "id": str(uuid.uuid4()),
            "step": step,
            "timestamp": time.time(),
            "action": action,
            "code": code,
            "result": result,
            "success": success,
        }
        self.episodic_memory = (self.episodic_memory + [episode])[-_MAX_EPISODES:]
        self._queue("episodic", "history", {"items": self.episodic_memory})

    def record_reflection(self, step: int, error: str, hypothesis: str, correction: str):
        reflection = {
            "id": str(uuid.uuid4()),
            "step": step,
            "timestamp": time.time(),
            "error": error,
            "hypothesis": hypothesis,
            "correction": correction,
        }
        self.reflections = (self.reflections + [reflection])[-_MAX_REFLECTIONS:]
        self._queue("reflection", "history", {"items": self.reflections})

    def store_knowledge(self, key: str, value: Any):
        self.semantic_memory[key[:240]] = value
        self._queue("semantic", key, {"value": value})

    def recall_knowledge(self, key: str) -> Optional[Any]:
        return self.semantic_memory.get(key)

    async def flush(self) -> dict[str, Any]:
        if not self.user_id or not self._pending:
            if self.user_id and self.persistence_status == "pending":
                self.persistence_status = "loaded"
            return {"status": self.persistence_status, "written": 0}
        pool = await get_pool()
        if not pool:
            self.persistence_status = "unavailable"
            self.persistence_error = "database pool unavailable"
            return {"status": self.persistence_status, "written": 0, "error": self.persistence_error}
        pending = self._pending
        self._pending = []
        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    for memory_type, memory_key, payload in pending:
                        await conn.execute(
                            """
                            INSERT INTO agent_memories(user_id, memory_type, memory_key, payload, updated_at)
                            VALUES ($1, $2, $3, $4::jsonb, now())
                            ON CONFLICT(user_id, memory_type, memory_key)
                            DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()
                            """,
                            self.user_id,
                            memory_type,
                            memory_key,
                            json.dumps(payload, ensure_ascii=False, default=str),
                        )
            self.persistence_status = "persisted"
            self.persistence_error = None
            return {"status": self.persistence_status, "written": len(pending)}
        except Exception as exc:  # noqa: BLE001 - do not claim durable memory after a failed write
            self._pending = pending + self._pending
            self.persistence_status = "failed"
            self.persistence_error = type(exc).__name__
            logger.warning("agent memory flush failed: %s", exc)
            return {"status": self.persistence_status, "written": 0, "error": self.persistence_error}

    def get_summary(self) -> Dict[str, Any]:
        return {
            "total_episodes": len(self.episodic_memory),
            "successful_episodes": len([e for e in self.episodic_memory if e.get("success")]),
            "failed_episodes": len([e for e in self.episodic_memory if not e.get("success")]),
            "total_reflections": len(self.reflections),
            "semantic_keys": list(self.semantic_memory.keys()),
            "owner_scoped": bool(self.user_id),
            "persistence_status": self.persistence_status,
            "persistence_error": self.persistence_error,
        }
