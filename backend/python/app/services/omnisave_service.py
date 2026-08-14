from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from app.services.prompt_safety import untrusted as _untrusted
from app.services.db import get_pool
from app.services.llm_service import llm_complete, active_engine, LLMNotConfiguredError

logger = logging.getLogger(__name__)

# ponytail: exact insufficiency response the RAG prompt instructs the LLM to
# emit when the snippets do not answer the query. It is the ONLY answer accepted
# without citations; anything else must cite at least one recognized source.
_INSUFFICIENT_ANSWER_RESPONSE = "The indexed knowledge does not contain enough information to answer this question."


async def auto_enrich(title: str, body: str) -> Dict[str, Any]:
    """Return validated, user-visible NLP metadata for one saved source.

    The model output is intentionally schema-shaped and confidence-scored so the
    UI can distinguish automatic suggestions from user edits. When the AI
    service is unavailable, the fallback is explicit and never invents tags.
    """
    fallback: Dict[str, Any] = {
        "category": "Uncategorised",
        "topics": [],
        "keyphrases": [],
        "entities": [],
        "summary": None,
        "confidence": 0.0,
        "needs_review": True,
        "status": "needs_review",
        "model": "unavailable",
        "version": "nlp-v1",
    }
    if not active_engine() or active_engine() == "mock":
        return fallback
    try:
        import json as _json
        prompt = (
            "Read this saved article and respond ONLY with compact JSON. "
            "Never invent facts not present in the text.\n"
            '{"category":"one short label", "topics":["up to 6 short tags"], '
            '"keyphrases":["up to 8 phrases"], "entities":["people, companies, products or technologies"], '
            '"one_line_summary":"<= 180 chars or null", "confidence":0.0, "needs_review":false}\n\n'
            f"TITLE: {title[:240]}\n\nBODY (truncated):\n{(body or '')[:5000]}"
        )
        raw = await llm_complete(
            "You are a precise information extraction and tagging engine. Output valid JSON only.",
            prompt,
            tier="fast",
            max_tokens=420,
            temperature=0.1,
        )
        parsed = _json.loads(raw.strip().strip("`").lstrip("json").strip())
        def clean_list(value: Any, limit: int, width: int) -> list[str]:
            if not isinstance(value, list):
                return []
            return [str(item).strip()[:width] for item in value if str(item).strip()][:limit]
        confidence = float(parsed.get("confidence") or 0.0)
        confidence = max(0.0, min(1.0, confidence))
        needs_review = bool(parsed.get("needs_review")) or confidence < 0.62
        return {
            "category": str(parsed.get("category") or "Uncategorised").strip()[:80],
            "topics": clean_list(parsed.get("topics"), 6, 40),
            "keyphrases": clean_list(parsed.get("keyphrases"), 8, 60),
            "entities": clean_list(parsed.get("entities"), 12, 80),
            "summary": str(parsed.get("one_line_summary")).strip()[:180] if parsed.get("one_line_summary") else None,
            "confidence": round(confidence, 3),
            "needs_review": needs_review,
            "status": "needs_review" if needs_review else "ready",
            "model": str(active_engine() or "unknown"),
            "version": "nlp-v1",
        }
    except Exception as exc:  # noqa: BLE001 — enrichment never breaks ingest
        logger.warning("auto_enrich failed: %s", exc)
        return fallback


async def auto_tag(title: str, body: str) -> tuple[str, list[str], str | None]:
    """Backward-compatible adapter for callers that only need category/topics/summary."""
    enriched = await auto_enrich(title, body)
    return enriched["category"], enriched["topics"], enriched["summary"]

async def fetch_substack_rss(publication_url: str) -> list[dict]:
    """WS-07: real Substack RSS ingest. Substack exposes `/api/v1/archive` or
    the standard `/feed` suffix; both are public and need no OAuth. Returns
    a list of {url, title, author, content} dicts, empty on any failure
    (so the caller falls back to single-URL scraping).

    Legal boundary: robots.txt is checked for the publication origin and
    outbound backoff is applied before the fetch. A robots-disallowed feed
    returns [] and is logged.
    """
    import httpx
    from app.services.scraping_policy import (
        aassert_robots_allowed,
        RobotsDisallowedError,
        await_backoff,
    )
    feed_url = publication_url.rstrip("/") + "/feed"
    try:
        await aassert_robots_allowed(feed_url)
    except RobotsDisallowedError:
        logger.info("SKIPPED: robots.txt disallows %s", feed_url)
        return []
    await await_backoff(feed_url)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(feed_url, headers={"User-Agent": "JobTayari-Omnisave/1.0"})
            resp.raise_for_status()
        # Minimal RSS parse — no extra dep. Items: <item><title/><link/>
        # <description/><content:encoded/></item>
        text = resp.text
        items: list[dict] = []
        for m in re.finditer(r"<item>([\s\S]*?)</item>", text, re.IGNORECASE):
            block = m.group(1)
            def _field(tag: str) -> str:
                mm = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", block, re.IGNORECASE | re.DOTALL)
                return mm.group(1).strip() if mm else ""
            link = _field("link")
            if not link:
                continue
            title = _field("title")
            # Strip nested CDATA/tags from description/content
            content = _field("content:encoded") or _field("description")
            content = re.sub(r"<[^>]+>", " ", content)
            content = re.sub(r"\s+", " ", content).strip()
            items.append({
                "url": link,
                "title": title or link,
                "author": _field("author") or "Substack",
                "content": content[:8000],
            })
        return items[:25]
    except Exception as exc:  # noqa: BLE001
        logger.info("fetch_substack_rss: %s failed (%s)", feed_url, exc)
        return []

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
                             secondary_tags, summary_bullets, nlp_metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
                        source_obj.get("secondary_tags") or [],
                        source_obj.get("summary_bullets") or [],
                        json.dumps(source_obj.get("nlp_metadata") or {}),
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
                                   secondary_tags, summary_bullets, nlp_metadata, created_at
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
                            "secondary_tags": canonical["secondary_tags"] or [],
                            "summary_bullets": canonical["summary_bullets"] or [],
                            "nlp_metadata": canonical["nlp_metadata"] or {},
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
                           secondary_tags, summary_bullets, nlp_metadata, created_at
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
                "secondary_tags": row["secondary_tags"] or [],
                "summary_bullets": row["summary_bullets"] or [],
                "nlp_metadata": row["nlp_metadata"] or {},
                "saved_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
        except Exception as exc:
            logger.warning("[Omnisave] Failed to look up existing source in DB: %s", exc)
            return None

    async def ingest_source(self, platform: str, url: str, title: str, author: str, raw_content: str, user_id: str, category: str | None = None, summary_bullets: Optional[List[str]] = None, topics: Optional[List[str]] = None) -> Dict[str, Any]:
        """Ingest source from Substack, Medium, LinkedIn, or custom URL.

        WS-07: when ``category`` is not provided we run a real LLM auto-tag
        call rather than hardcoding 'Career Strategy' for every article. When
        no LLM is configured we fall back to the honest 'Uncategorised' label,
        never a fabricated specific topic.
        """
        if platform not in ("substack", "medium", "linkedin", "custom_url"):
            platform = "custom_url"

        # WS-07: real auto-tagging at ingest, replacing the hardcoded category.
        # Topics + one-line summary are retained so secondary_tags and
        # summary_bullets are no longer discarded.
        nlp_metadata = await auto_enrich(title, raw_content)
        auto_topics: List[str] = nlp_metadata.get("topics") or []
        auto_summary: str | None = nlp_metadata.get("summary")
        if not category:
            category = nlp_metadata.get("category") or "Uncategorised"

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
                "durably_persisted": True,
            }

        # ponytail: in-memory dedup scoped to (user_id, idempotency_hash) is
        # supplemental only — it guards against duplicates within this process
        # when the DB is unavailable.
        for source in self.saved_sources:
            if source.get("user_id") == user_id and source.get("idempotency_hash") == idempotency_hash:
                return {
                    "success": True,
                    "source_id": source.get("id"),
                    "source": source,
                    "message": "Source already ingested.",
                    "durably_persisted": False,
                }

        source_id = str(uuid_lib.uuid4())
        # ponytail: caller-provided topics/summary win; auto-tagged values
        # only fill the gap so the DB row never loses what auto_tag produced.
        # Caller topics get the same normalization auto_tag applies (trim,
        # 40-char cap, empty-filter, 5-tag cap); an empty result falls back to
        # the auto-tagged topics rather than persisting a blank tag list.
        normalized_topics = None
        if topics is not None:
            normalized_topics = [t.strip()[:40] for t in topics if t.strip()][:5]
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
            "secondary_tags": normalized_topics if normalized_topics else auto_topics,
            # WS-07: no fabricated "insight" bullets. If no real summary was
            # produced, say nothing rather than inventing one. A caller-provided
            # empty list is preserved (explicit "no summary"); the auto_summary
            # fallback fills in ONLY when summary_bullets is None (absent).
            "summary_bullets": summary_bullets if summary_bullets is not None else ([auto_summary] if auto_summary else []),
            "nlp_metadata": nlp_metadata,
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
                "durably_persisted": True,
            }

        return {
            "success": True,
            "source_id": source_id,
            "chunks_created": len(segments),
            "source": source_obj,
            # A cache-only result must never be presented as a durable candidate
            # knowledge record. API routes use this to fail closed when Postgres
            # is unavailable instead of losing a candidate's saved reading on a
            # restart.
            "durably_persisted": outcome is not None,
        }

    @staticmethod
    def _platform_for_url(url: str) -> str:
        """Classify a candidate-selected public URL without trusting UI hints."""
        from urllib.parse import urlparse

        host = (urlparse(url).hostname or "").lower()
        if host.endswith("substack.com"):
            return "substack"
        if host == "medium.com" or host.endswith(".medium.com"):
            return "medium"
        if host == "linkedin.com" or host.endswith(".linkedin.com"):
            return "linkedin"
        return "custom_url"

    def _discard_cached_source(self, source_id: str | None, user_id: str) -> None:
        """Remove a non-durable source from the process cache after a failed import."""
        if not source_id:
            return
        self.saved_sources = [
            source for source in self.saved_sources
            if not (source.get("id") == source_id and source.get("user_id") == user_id)
        ]
        self.source_chunks = [
            chunk for chunk in self.source_chunks
            if not (chunk.get("source_id") == source_id and chunk.get("user_id") == user_id)
        ]

    async def import_public_url(self, user_id: str, url: str) -> Dict[str, Any]:
        """Import one explicitly selected public article URL into durable storage.

        This is deliberately not a private saved-list synchroniser. It performs
        extraction only for a URL the candidate supplied, rejects an unreadable
        or unsafe target, and fails closed if the resulting source cannot be
        durably persisted for that candidate.
        """
        target_url = (url or "").strip()
        if not target_url:
            return {"success": False, "error": "url_required"}

        platform = self._platform_for_url(target_url)
        extracted = await self.extract_via_tayari_computer(platform, target_url)
        if not extracted:
            return {"success": False, "error": "source_unavailable"}

        result = await self.ingest_source(
            platform=platform,
            url=extracted["url"],
            title=extracted["title"],
            author=extracted["author"],
            raw_content=extracted["content"],
            category=extracted.get("category"),
            user_id=user_id,
            summary_bullets=extracted.get("summary"),
            topics=extracted.get("topics"),
        )
        if not result.get("success"):
            return result
        if not result.get("durably_persisted"):
            self._discard_cached_source(result.get("source_id"), user_id)
            return {
                "success": False,
                "error": "persistence_unavailable",
                "message": "The source could not be stored safely. Nothing was saved.",
            }
        return result

    async def extract_via_tayari_computer(self, platform: str, target_url: str) -> Optional[Dict[str, Any]]:
        """
        Use Tayari Computer Accessibility Sandbox & Hermes browser operator
        to extract dynamic article title, author, and content without hardcoding.
        """
        try:
            from app.services.form_filler import FormFiller as TayariComputerSandboxExecutor, _resolve_and_validate_url
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
                        # WS-07: real auto-tag instead of the hardcoded label.
                        cat, topics, _summary = await auto_tag(
                            content_eval.get("title") or title,
                            content_eval.get("body"),
                        )
                        return {
                            "url": url_info["original_url"],
                            "title": content_eval.get("title") or title,
                            "author": content_eval.get("author") or f"{platform.title()} Author",
                            "category": cat,
                            "topics": topics,
                            "content": content_eval.get("body"),
                            "summary": content_eval.get("bullets") or [f"Extracted dynamic content from {url_info['original_url']}"]
                        }
        except Exception as exc:
            logger.warning("Tayari Computer sandbox extraction error for %s: %s", target_url, exc)
        return None

    async def sync_agent_reach_posts(
        self,
        user_id: str,
        platforms: Optional[List[str]] = None,
        target_urls: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Compatibility adapter for explicit public-URL imports.

        It does not enumerate any private saved-post list. ``platforms`` is
        retained only for clients that already send it; source classification is
        derived from each URL server-side. Every URL is handled independently so
        one blocked article cannot make successful imports disappear.
        """
        requested_urls = list(dict.fromkeys(url.strip() for url in (target_urls or []) if url and url.strip()))
        if not requested_urls:
            return {
                "success": False,
                "error": "url_required",
                "count": 0,
                "sources": [],
                "errors": [{"error": "url_required"}],
            }

        imported_sources: List[Dict[str, Any]] = []
        errors: List[Dict[str, str]] = []
        for url in requested_urls:
            result = await self.import_public_url(user_id=user_id, url=url)
            if result.get("success"):
                imported_sources.append(result.get("source") or {})
            else:
                errors.append({"url": url, "error": result.get("error", "import_failed")})

        # This read proves the response reflects the durable store, not a
        # worker-local cache. Let the route map a storage outage to 503.
        sources = await self.list_user_saved_sources(user_id)
        return {
            "success": bool(imported_sources),
            "count": len(imported_sources),
            "sources": sources,
            "errors": errors,
            "synced_platforms": platforms or [],
        }

    def get_user_saved_sources(self, user_id: str) -> List[Dict[str, Any]]:
        """Return cached saved sources for the requested user only.

        This compatibility helper exists for worker-local operations. Candidate
        API reads must use :meth:`list_user_saved_sources`, which reads the
        durable store and never turns an in-memory cache into a production
        source of truth.
        """
        return [s for s in self.saved_sources if s.get("user_id") == user_id]

    async def list_user_saved_sources(self, user_id: str) -> List[Dict[str, Any]]:
        """Return the candidate's durable sources, newest first, or fail closed."""
        try:
            pool = await get_pool()
            user_uuid = uuid_lib.UUID(user_id)
            if pool is None:
                raise RuntimeError("knowledge_store_unavailable")
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, user_id, idempotency_hash, source_platform, canonical_url,
                           title, author, raw_content, clean_markdown, primary_category,
                           secondary_tags, summary_bullets, nlp_metadata, created_at
                    FROM public.saved_sources
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    """,
                    user_uuid,
                )
        except Exception as exc:
            logger.error("[Omnisave] Durable source listing failed for user %r: %s", user_id, exc)
            raise RuntimeError("knowledge_store_unavailable") from exc

        sources = [
            {
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
                "secondary_tags": row["secondary_tags"] or [],
                "summary_bullets": row["summary_bullets"] or [],
                "nlp_metadata": row["nlp_metadata"] or {},
                "saved_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
            for row in rows
        ]
        # Keep worker cache warm only with records already confirmed durable.
        self.saved_sources = [s for s in self.saved_sources if s.get("user_id") != user_id] + sources
        return sources

    async def delete_user_source(self, user_id: str, source_id: str) -> bool:
        """Delete one durable source owned by the requesting candidate.

        ``source_chunks`` are removed by the database foreign-key cascade. A
        row absent for this user is intentionally indistinguishable from another
        candidate's source, preserving tenancy isolation.
        """
        try:
            pool = await get_pool()
            user_uuid = uuid_lib.UUID(user_id)
            source_uuid = uuid_lib.UUID(source_id)
            if pool is None:
                raise RuntimeError("knowledge_store_unavailable")
            async with pool.acquire() as conn:
                deleted = await conn.fetchrow(
                    "DELETE FROM public.saved_sources WHERE id = $1 AND user_id = $2 RETURNING id",
                    source_uuid,
                    user_uuid,
                )
        except ValueError:
            return False
        except Exception as exc:
            logger.error("[Omnisave] Durable source deletion failed for user %r: %s", user_id, exc)
            raise RuntimeError("knowledge_store_unavailable") from exc

        if deleted is None:
            return False
        self._discard_cached_source(source_id, user_id)
        return True

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
        # Candidate-facing answers are available only when the durable store is
        # reachable. A worker-local cache may warm retrieval, but it must never
        # become a hidden source of truth after a database outage or restart.
        durable_sources = await self.list_user_saved_sources(user_id)
        if not durable_sources:
            return {
                "query": query,
                "answer": "No indexed articles currently exist in your Omnisave AI Knowledge Base. Submit an article URL to ingest knowledge.",
                "citations": [],
                "context_snippets": [],
                "retrieved_count": 0,
                "has_evidence": False,
            }

        matched_chunks = await self._load_relevant_chunks_db(query, user_id, top_k)
        if not matched_chunks:
            matched_chunks = await self._load_user_chunks_db(user_id, top_k)
        if not matched_chunks:
            return {
                "query": query,
                "answer": _INSUFFICIENT_ANSWER_RESPONSE,
                "citations": [],
                "context_snippets": [],
                "retrieved_count": 0,
                "has_evidence": False,
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
                "source_id": chk.get("source_id"),
                "title": src_info.get("title", "Saved Article"),
                "author": src_info.get("author", "Unknown"),
                "url": src_info.get("canonical_url", "#"),
                # Evidence is intentionally bounded: citations should be useful
                # for inspection without exposing the entire imported document.
                "excerpt": re.sub(r"\s+", " ", chk.get("chunk_content", "")).strip()[:320],
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
            "context_snippets": rag_context_snippets,
            "retrieved_count": len(sources_reference),
            "has_evidence": bool(sources_reference) and answer != _INSUFFICIENT_ANSWER_RESPONSE,
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

