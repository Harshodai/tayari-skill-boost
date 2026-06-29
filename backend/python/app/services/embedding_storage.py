"""Persistent storage for document embeddings using pgvector."""
from __future__ import annotations

import hashlib
import json
import logging
from typing import List, Optional, Any

from app.services.db import get_pool
from app.services.embedding_service import embed_texts

logger = logging.getLogger(__name__)


async def store_embedding(
    user_id: str,
    content_type: str,
    content_id: str,
    text: str,
    metadata: dict | None = None,
) -> bool:
    """Generate and store embedding for a document."""
    pool = await get_pool()
    if not pool:
        logger.debug("DB disabled — embedding not stored")
        return False
    
    # Generate embedding
    vectors = await embed_texts([text[:2000]])  # Truncate for speed
    if not vectors or not vectors[0]:
        return False
    
    content_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
    embedding_str = "[" + ",".join(str(v) for v in vectors[0]) + "]"
    
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO document_embeddings 
                    (user_id, content_type, content_id, content_hash, embedding, text_preview, metadata)
                VALUES ($1, $2, $3, $4, $5::vector, $6, $7::jsonb)
                ON CONFLICT (user_id, content_type, content_id) 
                DO UPDATE SET 
                    embedding = EXCLUDED.embedding,
                    content_hash = EXCLUDED.content_hash,
                    text_preview = EXCLUDED.text_preview,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
                """,
                user_id, content_type, content_id, content_hash,
                embedding_str, text[:200], json.dumps(metadata or {})
            )
        return True
    except Exception as exc:
        logger.warning("Failed to store embedding: %s", exc)
        return False


async def find_similar(
    user_id: str,
    query_text: str,
    content_type: Optional[str] = None,
    limit: int = 10,
    min_similarity: float = 0.5,
) -> List[dict]:
    """Find documents similar to query text using cosine similarity."""
    pool = await get_pool()
    if not pool:
        return []
    
    vectors = await embed_texts([query_text[:2000]])
    if not vectors or not vectors[0]:
        return []
    
    query_vec = "[" + ",".join(str(v) for v in vectors[0]) + "]"
    
    try:
        async with pool.acquire() as conn:
            where_clause = "user_id = $1"
            params = [user_id, query_vec, min_similarity, limit]
            
            if content_type:
                where_clause += " AND content_type = $5"
                params.append(content_type)
            
            rows = await conn.fetch(
                f"""
                SELECT 
                    content_type, content_id, text_preview, metadata,
                    1 - (embedding <=> $2::vector) as similarity
                FROM document_embeddings
                WHERE {where_clause}
                  AND 1 - (embedding <=> $2::vector) >= $3
                ORDER BY embedding <=> $2::vector
                LIMIT $4
                """,
                *params
            )
            return [dict(r) for r in rows]
    except Exception as exc:
        logger.warning("Similarity search failed: %s", exc)
        return []
