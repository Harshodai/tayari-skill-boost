import asyncio
import hashlib
import logging
import re
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from app.services.autopilot_graph import _untrusted
from app.services.db import get_pool
from app.services.llm_service import llm_complete

logger = logging.getLogger(__name__)

# ponytail: exact insufficiency response the RAG prompt instructs the LLM to
# emit when the snippets do not answer the query. It is the ONLY answer accepted
# without citations; anything else must cite at least one recognized source.
_INSUFFICIENT_ANSWER_RESPONSE = "The indexed knowledge does not contain enough information to answer this question."

class OmnisaveService:
    """
    Omnisave AI Hybrid RAG Engine.
    Connectors for Substack RSS, Medium reading feeds, and LinkedIn saved items.
    Chunks body text into 512-token segments and constructs RAG prompts with
    mandatory inline citations ([Source 1], [Source 2]).

    Retrieval is vector-based: the query is embedded (fastembed, 384 dims) and
    matched against ``public.source_chunks.embedding`` via pgvector cosine
    distance. If embeddings or the DB are unavailable, retrieval degrades to a
    recency-ordered read (``ORDER BY created_at DESC LIMIT top_k``) and finally
    to the in-memory store scoped to the requesting user.

    Persistence: sources and chunks are written to Postgres
    (public.saved_sources / public.source_chunks) whenever the DB pool is
    available. Writes are best-effort and never block the request.
    """

    def __init__(self):
        self.saved_sources: List[Dict[str, Any]] = []
        self.source_chunks: List[Dict[str, Any]] = []

    async def _persist_source_db(self, source_obj: Dict[str, Any], chunks: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Best-effort write of a source + its chunks to Postgres.

        Returns an outcome dict when a DB pool is available:
        ``{"inserted": True, "source": source_obj, "chunks_created": len(chunks)}``
        on a successful insert, or ``{"inserted": False, "source": <canonical row>,
        "chunks_created": 0}`` when ``ON CONFLICT DO NOTHING`` lost the race and
        the canonical source was resolved by (user_id, idempotency_hash).
        Returns ``None`` when no DB is configured or the write fails.
        """
        try:
            pool = await get_pool()
            if pool is None:
                return None
            user_uuid = uuid_lib.UUID(source_obj["user_id"])
        except (ValueError, TypeError, KeyError) as exc:
            # ponytail: an invalid JWT subject is a distinct failure mode from an
            # unconfigured database — surface it so invalid-subject ingests are
            # distinguishable in logs instead of looking like a DB absence.
            logger.warning("[Omnisave] Invalid user_id %r; cannot persist to DB: %s", source_obj.get("user_id"), exc)
            return None
        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    inserted = await conn.fetchrow(
                        """
                        INSERT INTO public.saved_sources
                            (id, user_id, idempotency_hash, source_platform, canonical_url,
                             title, author, raw_content, clean_markdown, primary_category,
                             secondary_tags, summary_bullets)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        ON CONFLICT (user_id, idempotency_hash) DO NOTHING
                        RETURNING id
                        """,
                        uuid_lib.UUID(source_obj["id"]),
                        user_uuid,
                        source_obj["idempotency_hash"],
                        source_obj["source_platform"],
                        source_obj["canonical_url"],
                        source_obj["title"],
                        source_obj["author"],
                        source_obj["raw_content"],
                        source_obj["clean_markdown"],
                        source_obj["primary_category"],
                        None,
                        source_obj.get("summary_bullets") or [],
                    )
                    # ponytail: ON CONFLICT DO NOTHING with no RETURNING row means a
                    # concurrent insert won. Resolve the canonical row by
                    # (user_id, idempotency_hash) and skip chunk writes so the
                    # provisional source is discarded, not duplicated.
                    if inserted is None:
                        canonical = await conn.fetchrow(
                            """
                            SELECT id, user_id, idempotency_hash, source_platform, canonical_url,
                                   title, author, raw_content, clean_markdown, primary_category,
                                   secondary_tags, summary_bullets, created_at
                            FROM public.saved_sources
                            WHERE user_id = $1 AND idempotency_hash = $2
                            """,
                            user_uuid,
                            source_obj["idempotency_hash"],
                        )
                        if canonical is None:
                            return None
                        canonical_source = {
                            "id": str(canonical["id"]),
                            "user_id": str(canonical["user_id"]),
                            "idempotency_hash": canonical["idempotency_hash"],
                            "source_platform": canonical["source_platform"],
                            "canonical_url": canonical["canonical_url"],
                            "title": canonical["title"],
                            "author": canonical["author"],
                            "raw_content": canonical["raw_content"],
                            "clean_markdown": canonical["clean_markdown"],
                            "primary_category": canonical["primary_category"],
                            "summary_bullets": canonical["summary_bullets"] or [],
                            "saved_at": canonical["created_at"].isoformat() if canonical["created_at"] else None,
                        }
                        return {"inserted": False, "source": canonical_source, "chunks_created": 0}
                    for chunk in chunks:
                        # WS-07: persist the real embedding so retrieval can be
                        # semantic. NULL only when the embedding model is absent.
                        vector = chunk.get("embedding")
                        vector_literal = (
                            "[" + ",".join(str(float(v)) for v in vector) + "]"
                            if vector
                            else None
                        )
                        await conn.execute(
                            """
                            INSERT INTO public.source_chunks
                                (id, source_id, user_id, chunk_index, chunk_content, embedding)
                            VALUES ($1, $2, $3, $4, $5, $6::vector)
                            ON CONFLICT DO NOTHING
                            """,
                            uuid_lib.UUID(chunk["id"]),
                            uuid_lib.UUID(source_obj["id"]),
                            user_uuid,
                            chunk["chunk_index"],
                            chunk["chunk_content"],
                            vector_literal,
                        )
                    return {"inserted": True, "source": source_obj, "chunks_created": len(chunks)}
        except Exception as exc:
            logger.error("[Omnisave] Failed to persist source to DB: %s", exc)
            return None

    def compute_idempotency_hash(self, url: str, content: str) -> str:
        """Compute unique SHA-256 hash for source deduplication."""
        raw = f"{url}:{content}".encode("utf-8")
        return hashlib.sha256(raw).hexdigest()

    def chunk_text(self, text: str, chunk_size_words: int = 400) -> List[str]:
        """Split text into 512-token (~400 word) overlapping segments."""
        words = text.split()
        if not words:
            return []
        chunks = []
        for i in range(0, len(words), chunk_size_words):
            segment = " ".join(words[i:i + chunk_size_words])
            chunks.append(segment)
        return chunks

    async def _find_existing_source_db(self, user_id: str, idempotency_hash: str) -> Optional[Dict[str, Any]]:
        """Look up a persisted source matching (user_id, idempotency_hash). None when DB unavailable or not found."""
        try:
            pool = await get_pool()
            if pool is None:
                return None
            user_uuid = uuid_lib.UUID(user_id)
        except (ValueError, TypeError) as exc:
            logger.warning("[Omnisave] Invalid user_id %r; cannot look up existing source: %s", user_id, exc)
            return None
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT id, user_id, idempotency_hash, source_platform, canonical_url,
                           title, author, raw_content, clean_markdown, primary_category,
                           secondary_tags, summary_bullets, created_at
                    FROM public.saved_sources
                    WHERE user_id = $1 AND idempotency_hash = $2
                    """,
                    user_uuid,
                    idempotency_hash,
                )
            if row is None:
                return None
            return {
                "id": str(row["id"]),
                "user_id": str(row["user_id"]),
                "idempotency_hash": row["idempotency_hash"],
                "source_platform": row["source_platform"],
                "canonical_url": row["canonical_url"],
                "title": row["title"],
                "author": row["author"],
                "raw_content": row["raw_content"],
                "clean_markdown": row["clean_markdown"],
                "primary_category": row["primary_category"],
                "summary_bullets": row["summary_bullets"] or [],
                "saved_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
        except Exception as exc:
            logger.warning("[Omnisave] Failed to look up existing source in DB: %s", exc)
            return None

    async def ingest_source(self, platform: str, url: str, title: str, author: str, raw_content: str, user_id: str, category: str = "Career Strategy", summary_bullets: Optional[List[str]] = None) -> Dict[str, Any]:
        """Ingest source from Substack, Medium, LinkedIn, or custom URL."""
        if platform not in ("substack", "medium", "linkedin", "custom_url"):
            platform = "custom_url"

        idempotency_hash = self.compute_idempotency_hash(url, raw_content)

        # ponytail: DB is the source of truth for dedup — an already-persisted
        # (user_id, idempotency_hash) row short-circuits to an idempotent success
        # instead of generating a fresh source_id.
        existing = await self._find_existing_source_db(user_id, idempotency_hash)
        if existing is not None:
            if not any(s.get("id") == existing["id"] for s in self.saved_sources):
                self.saved_sources.append(existing)
                chunks = await self._load_source_chunks_db(existing["id"], user_id)
                for chk in chunks:
                    if not any(c.get("id") == chk["id"] for c in self.source_chunks):
                        self.source_chunks.append(chk)
            return {
                "success": True,
                "source_id": existing["id"],
                "chunks_created": 0,
                "source": existing,
                "message": "Source already ingested.",
            }

        # ponytail: in-memory dedup scoped to (user_id, idempotency_hash) is
        # supplemental only — it guards against duplicates within this process
        # when the DB is unavailable.
        for source in self.saved_sources:
            if source.get("user_id") == user_id and source.get("idempotency_hash") == idempotency_hash:
                return {"success": True, "source": source, "message": "Source already ingested."}

        source_id = str(uuid_lib.uuid4())
        source_obj = {
            "id": source_id,
            "user_id": user_id,
            "idempotency_hash": idempotency_hash,
            "source_platform": platform,
            "canonical_url": url,
            "title": title,
            "author": author,
            "raw_content": raw_content,
            "clean_markdown": f"# {title}\n*By {author} ({platform.title()})*\n\n{raw_content}",
            "primary_category": category,
            # WS-07: no fabricated "insight" bullets. If no real summary was
            # produced, say nothing rather than inventing one.
            "summary_bullets": summary_bullets or [],
            "saved_at": datetime.now(timezone.utc).isoformat()
        }
        self.saved_sources.append(source_obj)

        # Compute chunks
        segments = self.chunk_text(raw_content)
        vectors = await self._embed(segments)
        chunk_objs = []
        for idx, seg in enumerate(segments):
            chunk_obj = {
                "id": str(uuid_lib.uuid4()),
                "source_id": source_id,
                "user_id": user_id,
                "chunk_index": idx,
                "chunk_content": seg,
                "embedding": vectors[idx] if vectors and idx < len(vectors) else None,
            }
            self.source_chunks.append(chunk_obj)
            chunk_objs.append(chunk_obj)

        outcome = await self._persist_source_db(source_obj, chunk_objs)
        if outcome is not None and not outcome["inserted"]:
            # ponytail: the insert lost an ON CONFLICT race — discard the
            # provisional source/chunk state and return the canonical row so the
            # caller does not see a fabricated or duplicate ingest.
            self.saved_sources = [s for s in self.saved_sources if s.get("id") != source_id]
            self.source_chunks = [c for c in self.source_chunks if c.get("source_id") != source_id]
            canonical = outcome["source"]
            if not any(s.get("id") == canonical["id"] for s in self.saved_sources):
                self.saved_sources.append(canonical)
            chunks = await self._load_source_chunks_db(canonical["id"], user_id)
            for chk in chunks:
                if not any(c.get("id") == chk["id"] for c in self.source_chunks):
                    self.source_chunks.append(chk)
            return {
                "success": True,
                "source_id": canonical["id"],
                "chunks_created": 0,
                "source": canonical,
                "message": "Source already ingested.",
            }

        return {
            "success": True,
            "source_id": source_id,
            "chunks_created": len(segments),
            "source": source_obj
        }

    async def extract_via_tayari_computer(self, platform: str, target_url: str) -> Optional[Dict[str, Any]]:
        """
        Use Tayari Computer Accessibility Sandbox & Hermes browser operator
        to extract dynamic article title, author, and content without hardcoding.
        """
        try:
            from app.services.sandbox_executor import TayariComputerSandboxExecutor, _resolve_and_validate_url
            url_info = _resolve_and_validate_url(target_url)
            if not url_info:
                logger.warning("[Omnisave] Rejected unsafe extraction URL: %s", target_url)
                return None
            async with TayariComputerSandboxExecutor() as executor:
                res = await executor.browser.navigate(url_info["target_url"], headers=url_info["headers"])
                if res.get("success") and executor.browser.page:
                    title = await executor.browser.page.title() or f"{platform.title()} Saved Item"
                    content_eval = await executor.browser.page.evaluate("""() => {
                        const article = document.querySelector('article') || document.querySelector('main') || document.body;
                        const headings = Array.from(article.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()).filter(Boolean);
                        const paragraphs = Array.from(article.querySelectorAll('p')).map(p => p.innerText.trim()).filter(p => p.length > 20);
                        const authorElem = document.querySelector('[rel="author"], .byline, [data-testid="authorName"]');
                        const author = authorElem ? authorElem.innerText.trim() : "";
                        return {
                            title: headings[0] || document.title,
                            author: author,
                            body: paragraphs.join(" "),
                            bullets: paragraphs.slice(0, 2)
                        };
                    }""")
                    if content_eval and content_eval.get("body"):
                        return {
                            "url": url_info["original_url"],
                            "title": content_eval.get("title") or title,
                            "author": content_eval.get("author") or f"{platform.title()} Author",
                            "category": "Career Strategy",
                            "content": content_eval.get("body"),
                            "summary": content_eval.get("bullets") or [f"Extracted dynamic content from {url_info['original_url']}"]
                        }
        except Exception as exc:
            logger.warning("Tayari Computer sandbox extraction error for %s: %s", target_url, exc)
        return None

    async def sync_agent_reach_posts(self, user_id: str, platforms: Optional[List[str]] = None, target_urls: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Use Agent Reach & Tayari Computer Sandbox extraction engine to fetch saved/bookmarked posts
        from Substack, Medium, and LinkedIn dynamically, and ingest them into vector memory.
        """
        target_platforms = platforms or ["substack", "medium", "linkedin"]
        synced_sources = []

        # Use explicitly provided URLs or discover via Agent Reach Hermes scraper
        urls_to_process = target_urls or []

        # Build platform->url mapping with positional assignment first, then name matching, then fallback
        platform_url_map = {}

        # Step 1: Assign positionally (target_urls[0] -> target_platforms[0], etc.)
        for i, platform in enumerate(target_platforms):
            if i < len(urls_to_process):
                platform_url_map[platform.lower()] = urls_to_process[i]

        # Step 2: For platforms without a positional URL, try matching by platform name
        for platform in target_platforms:
            plat_key = platform.lower()
            if plat_key not in platform_url_map:
                matching_urls = [u for u in urls_to_process if plat_key in u.lower()]
                if matching_urls:
                    platform_url_map[plat_key] = matching_urls[0]

        for platform in target_platforms:
            plat_key = platform.lower()
            url = platform_url_map.get(plat_key)
            if not url:
                # ponytail: never fabricate platform URLs to drive the browser at;
                # skip platforms without a user-supplied URL.
                logger.info("[Omnisave] No user-provided URL for platform %s; skipping", plat_key)
                continue

            extracted = await self.extract_via_tayari_computer(plat_key, url)
            if extracted:
                res = await self.ingest_source(
                    platform=plat_key,
                    url=extracted["url"],
                    title=extracted["title"],
                    author=extracted["author"],
                    raw_content=extracted["content"],
                    category=extracted["category"],
                    user_id=user_id,
                    summary_bullets=extracted["summary"]
                )
                if res.get("success"):
                    synced_sources.append(res.get("source"))

        user_sources = [s for s in self.saved_sources if s.get("user_id") == user_id]

        if not synced_sources and not user_sources:
            return {
                "success": False,
                "error": "No reachable saved post URLs or RSS feeds found. Please provide valid article URLs for Tayari Computer extraction.",
                "count": 0,
                "synced_platforms": target_platforms,
                "sources": []
            }

        return {
            "success": True,
            "count": len(synced_sources),
            "synced_platforms": target_platforms,
            "sources": user_sources
        }

    def get_user_saved_sources(self, user_id: str) -> List[Dict[str, Any]]:
        """Return saved sources for the requested user only."""
        return [s for s in self.saved_sources if s.get("user_id") == user_id]

    async def _load_source_chunks_db(self, source_id: str, user_id: str) -> List[Dict[str, Any]]:
        """Load a specific source's chunks from Postgres for in-memory rehydration."""
        try:
            pool = await get_pool()
            if pool is None:
                return []
            user_uuid = uuid_lib.UUID(user_id)
            src_uuid = uuid_lib.UUID(source_id)
        except (ValueError, TypeError) as exc:
            logger.warning("[Omnisave] Invalid user_id/source_id (%r/%r); cannot load source chunks: %s", user_id, source_id, exc)
            return []
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT c.id AS chunk_id, c.source_id, c.user_id, c.chunk_index, c.chunk_content,
                           s.title, s.author, s.canonical_url
                    FROM public.source_chunks c
                    JOIN public.saved_sources s ON s.id = c.source_id
                    WHERE c.user_id = $1 AND c.source_id = $2
                    ORDER BY c.chunk_index ASC
                    """,
                    user_uuid,
                    src_uuid,
                )
            return [
                {
                    "id": str(row["chunk_id"]),
                    "source_id": str(row["source_id"]),
                    # ponytail: rehydrated chunks must carry the user_id so the
                    # in-memory RAG fallback (which filters by user_id) can find
                    # them and no other user's chunks enter the context.
                    "user_id": str(row["user_id"]),
                    "chunk_index": row.get("chunk_index", 0),
                    "chunk_content": row["chunk_content"],
                    "title": row["title"],
                    "author": row["author"],
                    "canonical_url": row["canonical_url"],
                }
                for row in rows
            ]
        except Exception as exc:
            logger.warning("[Omnisave] Failed to load source chunks from DB: %s", exc)
            return []

    @staticmethod
    async def _embed(texts: List[str]) -> Optional[List[List[float]]]:
        """Embed texts off the event loop. Returns None when unavailable."""
        if not texts:
            return None
        try:
            from app.services.embedding_service import embed_texts

            return await asyncio.to_thread(embed_texts, list(texts))
        except Exception as exc:  # noqa: BLE001 — embeddings are best-effort
            logger.warning("[Omnisave] Embedding failed: %s", exc)
            return None

    async def _load_relevant_chunks_db(
        self, query: str, user_id: str, top_k: int
    ) -> List[Dict[str, Any]]:
        """pgvector cosine top-k for the user's chunks. Empty list on any miss."""
        vectors = await self._embed([query])
        if not vectors or not vectors[0]:
            return []
        query_literal = "[" + ",".join(str(float(v)) for v in vectors[0]) + "]"
        try:
            pool = await get_pool()
            if pool is None:
                return []
            user_uuid = uuid_lib.UUID(user_id)
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT c.id AS chunk_id, c.source_id, c.chunk_index, c.chunk_content,
                           s.title, s.author, s.canonical_url
                    FROM public.source_chunks c
                    JOIN public.saved_sources s ON s.id = c.source_id
                    WHERE c.user_id = $1 AND c.embedding IS NOT NULL
                    ORDER BY c.embedding <=> $2::vector
                    LIMIT $3
                    """,
                    user_uuid,
                    query_literal,
                    top_k,
                )
        except Exception as exc:  # noqa: BLE001 — fall back to recency
            logger.warning("[Omnisave] Vector retrieval failed: %s", exc)
            return []
        return [
            {
                "id": str(row["chunk_id"]),
                "source_id": str(row["source_id"]),
                "chunk_index": row.get("chunk_index", 0),
                "chunk_content": row["chunk_content"],
                "title": row["title"],
                "author": row["author"],
                "canonical_url": row["canonical_url"],
            }
            for row in rows
        ]

    async def _load_user_chunks_db(self, user_id: str, top_k: int) -> List[Dict[str, Any]]:
        """Read the user's most recent chunks from Postgres as a fallback.

        Best-effort: a connection or DSN error (including get_pool raising)
        falls through to the method's empty-list fallback rather than
        propagating through query_knowledge_rag.
        """
        try:
            pool = await get_pool()
            if pool is None:
                return []
            user_uuid = uuid_lib.UUID(user_id)
        except Exception as exc:  # noqa: BLE001 — best-effort fallback
            logger.warning("[Omnisave] Failed to load chunks for user %r: %s", user_id, exc)
            return []
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT c.id AS chunk_id, c.source_id, c.chunk_index, c.chunk_content,
                           s.title, s.author, s.canonical_url
                    FROM public.source_chunks c
                    JOIN public.saved_sources s ON s.id = c.source_id
                    WHERE c.user_id = $1
                    ORDER BY c.created_at DESC
                    LIMIT $2
                    """,
                    user_uuid,
                    top_k,
                )
            return [
                {
                    "id": str(row["chunk_id"]),
                    "source_id": str(row["source_id"]),
                    "chunk_index": row.get("chunk_index", 0),
                    "chunk_content": row["chunk_content"],
                    "title": row["title"],
                    "author": row["author"],
                    "canonical_url": row["canonical_url"],
                }
                for row in rows
            ]
        except Exception as exc:
            logger.warning("[Omnisave] Failed to load chunks from DB: %s", exc)
            return []

    async def query_knowledge_rag(self, query: str, user_id: str, top_k: int = 3) -> Dict[str, Any]:
        """
        Build RAG response with inline citations referencing indexed chunks ([Source 1], [Source 2]).

        Retrieval is semantic: the query is embedded and matched against the
        user's chunk embeddings with pgvector cosine distance. When embeddings
        are unavailable the recency-ordered loader is used as a fallback.
        """
        matched_chunks = await self._load_relevant_chunks_db(query, user_id, top_k)
        if not matched_chunks:
            matched_chunks = await self._load_user_chunks_db(user_id, top_k)
        if not matched_chunks:
            matched_chunks = [c for c in self.source_chunks if c.get("user_id") == user_id][:top_k]
        if not matched_chunks:
            return {
                "query": query,
                "answer": "No indexed articles currently exist in your Omnisave AI Knowledge Base. Use 'Sync Agent Reach' or submit an article URL to ingest knowledge.",
                "citations": [],
                "context_snippets": []
            }

        sources_reference = []
        rag_context_snippets = []
        for i, chk in enumerate(matched_chunks, 1):
            if chk.get("title"):
                src_info = chk
            else:
                src_info = next((s for s in self.saved_sources if s["id"] == chk.get("source_id")), {"title": "Saved Article", "author": "Unknown", "canonical_url": "#"})
            citation_tag = f"[Source {i}]"
            sources_reference.append({
                "citation": citation_tag,
                "title": src_info.get("title", "Saved Article"),
                "author": src_info.get("author", "Unknown"),
                "url": src_info.get("canonical_url", "#")
            })
            rag_context_snippets.append(f"{citation_tag} ({src_info.get('title')}): {chk['chunk_content']}")

        context_str = "\n\n".join(rag_context_snippets)
        prompt = (
            "Answer the user's question using only the indexed knowledge snippets below. "
            "Cite the exact sources you rely on using their citation tags ([Source 1], [Source 2], ...) "
            "at the point of use. If the snippets do not contain enough to answer, say so honestly.\n\n"
            "Question:\n" + _untrusted(query) + "\n\nIndexed knowledge:\n" + _untrusted(context_str)
        )
        answer = await asyncio.wait_for(
            llm_complete(
                system_message=(
                    "You are a knowledge-base assistant grounded strictly in the provided "
                    "indexed snippets. Never fabricate facts outside the snippets; cite "
                    "sources with their [Source N] tags."
                ),
                user_message=prompt,
            ),
            timeout=15.0,
        )

        # ponytail: only accept an answer that cites tags which actually exist in
        # sources_reference, or honestly reports insufficiency. Hallucinated
        # [Source N] tags are rejected so fabricated citations never reach callers.
        valid_answer = self._answer_is_grounded(answer, sources_reference)
        if not valid_answer:
            logger.warning("[Omnisave] RAG answer was not properly grounded; returning insufficiency response")
            answer = _INSUFFICIENT_ANSWER_RESPONSE

        return {
            "query": query,
            "answer": answer,
            "citations": sources_reference,
            "context_snippets": rag_context_snippets
        }

    @staticmethod
    def _answer_is_grounded(answer: str, sources_reference: List[Dict[str, Any]]) -> bool:
        """Return True when the answer is valid:
        - the exact insufficiency response with no citations, or
        - a substantive answer that cites at least one [Source N] tag present in
          sources_reference, and cites no unknown tags.

        A substantive answer that merely mentions an insufficiency marker (e.g.
        "not enough") without being the fixed response is still required to cite
        its sources.
        """
        if not answer or not isinstance(answer, str):
            return False
        stripped = answer.strip()
        if stripped == _INSUFFICIENT_ANSWER_RESPONSE:
            return True

        valid_tags = {src["citation"] for src in sources_reference}
        cited = re.findall(r"\[Source\s+(\d+)\]", answer, re.IGNORECASE)
        if not cited:
            return False
        for match in re.finditer(r"\[Source\s+(\d+)\]", answer, re.IGNORECASE):
            tag = f"[Source {match.group(1)}]"
            if tag not in valid_tags:
                return False
        return True


# Global singleton instance for in-memory service consistency
_omnisave_instance = OmnisaveService()

def get_omnisave_service() -> OmnisaveService:
    return _omnisave_instance

