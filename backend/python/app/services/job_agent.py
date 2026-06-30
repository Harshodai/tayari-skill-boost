from __future__ import annotations
"""Hermes-style agentic job search pipeline.

The agent follows the classic agent loop architecture (reason -> use tools -> rank):
  Step 1 PLAN    - derive the candidate's target query from profile/resume if absent
  Step 2 GATHER  - tool call: parallel multi-provider job search
  Step 3 RANK    - LLM scores each job against the candidate (match %, gaps, reason)
  Step 4 REPORT  - merged, ranked results + transparent agent trace
"""
import asyncio
import logging
import re
from datetime import datetime, timezone

from app.services.job_providers import search_jobs
from app.services.llm_service import llm_complete, extract_json, active_engine
from app.services.skill_taxonomy import taxonomy_overlap
from app.services.embedding_service import embed_texts, cosine_similarity
from app.services.portal_scanner import annotate_jobs_with_ats

logger = logging.getLogger(__name__)


async def _hermes_scrape(query: str, location: str, target_board: dict | None) -> list[dict]:
    """Run the tiered Hermes scraper; return [] on any failure.

    Lazy-imported so the module stays importable when the hermes package or
    its optional deps are absent. Every provider failure is caught inside the
    orchestrator, so a scrape never raises out of here.
    """
    try:
        from app.services.hermes import HermesScraper
    except Exception as exc:  # noqa: BLE001 - hermes is optional
        logger.warning("Hermes scrape skipped (package unavailable): %s", exc)
        return []
    try:
        scraper = HermesScraper()
        return await scraper.scrape(query, location, board=target_board)
    except Exception as exc:  # noqa: BLE001 - scrape must not break the pipeline
        logger.warning("Hermes scrape failed: %s", exc)
        return []


RANK_SYSTEM = (
    "You are Tayari's matching engine, an expert technical recruiter. "
    "You score how well a candidate fits each job. Be honest and discriminating: "
    "scores should spread between 20 and 95. Always respond with pure JSON only."
)


def _candidate_summary(profile: dict | None, resume_text: str | None) -> str:
    parts = []
    if profile:
        if profile.get("headline"):
            parts.append(f"Headline: {profile['headline']}")
        if profile.get("desired_roles"):
            parts.append("Desired roles: " + ", ".join(profile["desired_roles"]))
        if profile.get("skills"):
            parts.append("Skills: " + ", ".join(profile["skills"]))
        if profile.get("experience_years") is not None:
            parts.append(f"Years of experience: {profile['experience_years']}")
        if profile.get("summary"):
            parts.append(f"Summary: {profile['summary'][:500]}")
    if resume_text:
        parts.append("Resume excerpt:\n" + resume_text[:2500])
    return "\n".join(parts) or "No candidate details provided."


async def derive_query(profile: dict | None, resume_text: str | None) -> str:
    """Agent PLAN step - figure out what to search for."""
    if profile and profile.get("desired_roles"):
        return profile["desired_roles"][0]
    if profile and profile.get("headline"):
        return profile["headline"]
    if resume_text:
        try:
            raw = await llm_complete(
                "You extract the single most likely job search query (a job title, "
                "2-4 words) from a resume. Respond with ONLY the query text.",
                resume_text[:2000], tier="fast")
            return raw.strip().strip('"')[:60]
        except Exception as exc:
            logger.warning("Query derivation failed: %s", exc)
    return "software engineer"


def expand_queries(primary: str, profile: dict | None) -> list:
    """Multi-query expansion (advanced retrieval pattern): search several related
    role formulations so the GATHER stage casts a wider, smarter net."""
    queries = [primary]
    if profile:
        for role in (profile.get("desired_roles") or [])[:3]:
            if role.lower() != primary.lower():
                queries.append(role)
        headline = (profile.get("headline") or "").strip()
        if headline and headline.lower() != primary.lower() and len(queries) < 3:
            queries.append(headline[:60])
    return queries[:3]


def _candidate_tokens(profile: dict | None, resume_text: str | None) -> set:
    parts = []
    if profile:
        parts += profile.get("skills", []) + profile.get("desired_roles", [])
        parts.append(profile.get("headline", ""))
    if resume_text:
        parts.append(resume_text[:3000])
    text = " ".join(parts).lower()
    return {t for t in re.findall(r"[a-z][a-z+#.\-]{2,}", text)}


def lexical_prerank(jobs: list, profile: dict | None, resume_text: str | None) -> list:
    """Stage-1 ranking (cheap, deterministic): skill/keyword overlap + recency boost.
    Ensures the LLM (stage 2) spends its context on the most promising jobs
    instead of an arbitrary first-N slice."""
    cand = _candidate_tokens(profile, resume_text)
    if not cand:
        return jobs
    now = datetime.now(timezone.utc)
    scored = []
    for j in jobs:
        job_text = " ".join([j["title"], " ".join(j.get("tags", [])),
                             j.get("description", "")[:800]]).lower()
        job_tokens = {t for t in re.findall(r"[a-z][a-z+#.\-]{2,}", job_text)}
        overlap = len(cand & job_tokens)
        recency = 0.0
        try:
            posted = datetime.fromisoformat(str(j.get("posted_at", "")).replace("Z", "+00:00"))
            if posted.tzinfo is None:
                posted = posted.replace(tzinfo=timezone.utc)
            age_days = max((now - posted).days, 0)
            recency = max(0.0, 5.0 - age_days / 3.0)  # fresh jobs get up to +5
        except Exception:
            pass
        scored.append((overlap + recency, j))
    scored.sort(key=lambda x: -x[0])
    return [j for _, j in scored]


def _candidate_text(profile: dict | None, resume_text: str | None) -> str:
    parts = []
    if profile:
        parts += profile.get("skills", []) + profile.get("desired_roles", [])
        parts.append(profile.get("headline", ""))
        parts.append((profile.get("summary") or "")[:400])
    if resume_text:
        parts.append(resume_text[:2500])
    return " ".join(p for p in parts if p)


async def hybrid_prerank(jobs: list, profile: dict | None,
                         resume_text: str | None) -> tuple:
    """World-class hybrid retrieval (research-backed): three independent rankers -
      1. lexical (keyword overlap + recency)
      2. skill-taxonomy (canonical skills + adjacency, ESCO/O*NET-style)
      3. semantic embeddings (local open-source BGE model)
    fused with Reciprocal Rank Fusion. Degrades gracefully if embeddings unavailable.
    Returns (ranked_jobs, method_description)."""
    if len(jobs) <= 1:
        return jobs, "none"
    cand_text = _candidate_text(profile, resume_text)

    # Ranker 1: lexical
    lex_sorted = lexical_prerank(list(jobs), profile, resume_text)
    lex_rank = {j["job_id"]: r for r, j in enumerate(lex_sorted)}

    # Ranker 2: skill taxonomy with adjacency
    tax_scored = []
    for j in jobs:
        job_text = f"{j['title']} {' '.join(j.get('tags', []))} {j.get('description', '')[:900]}"
        tax_scored.append((taxonomy_overlap(cand_text, job_text)["score"], j))
    tax_scored.sort(key=lambda x: -x[0])
    tax_rank = {j["job_id"]: r for r, (_, j) in enumerate(tax_scored)}

    # Ranker 3: semantic embeddings (off the event loop - CPU-bound ONNX)
    vec_rank = None
    method = "lexical + skill-taxonomy"
    try:
        texts = [cand_text[:1200]] + [
            f"{j['title']} at {j['company']}. {j.get('description', '')[:500]}" for j in jobs]
        vectors = await asyncio.to_thread(embed_texts, texts)
        if vectors:
            cand_vec = vectors[0]
            sims = [(cosine_similarity(cand_vec, v), j) for v, j in zip(vectors[1:], jobs)]
            sims.sort(key=lambda x: -x[0])
            vec_rank = {j["job_id"]: r for r, (_, j) in enumerate(sims)}
            method = "lexical + skill-taxonomy + semantic embeddings, RRF-fused"
    except Exception as exc:
        logger.warning("Embedding ranking skipped: %s", exc)

    K = 60  # standard RRF constant

    def rrf(j):
        score = 1 / (K + lex_rank[j["job_id"]]) + 1 / (K + tax_rank[j["job_id"]])
        if vec_rank is not None:
            score += 1 / (K + vec_rank[j["job_id"]])
        return score

    ranked = sorted(jobs, key=lambda j: -rrf(j))
    return ranked, method


async def rank_jobs(candidate: str, jobs: list, top_n: int = 12) -> list:
    """Agent RANK step - one batched LLM call scoring all jobs."""
    subset = jobs[:top_n * 2][:20]
    if not subset:
        return []
    lines = []
    for i, j in enumerate(subset):
        lines.append(
            f"[{i}] {j['title']} @ {j['company']} | {j['location']} | "
            f"tags: {', '.join(j['tags'][:8])} | {j['description'][:280]}")
    user_msg = (
        f"CANDIDATE:\n{candidate}\n\nJOBS:\n" + "\n".join(lines) +
        "\n\nScore every job for this candidate. Respond with a JSON array, one item "
        "per job: {\"index\": <int>, \"match_score\": <0-100 int>, "
        "\"matched_skills\": [<=5 strings], \"missing_skills\": [<=4 strings], "
        "\"reason\": \"<one concise sentence>\"}")
    try:
        raw = await llm_complete(RANK_SYSTEM, user_msg, tier="fast")
        scores = extract_json(raw)
    except Exception as exc:
        logger.error("Job ranking LLM failed: %s", exc)
        # graceful degradation: return unranked jobs
        for j in subset:
            j["match_score"] = None
            j["match_reason"] = "AI ranking unavailable"
            j["matched_skills"] = []
            j["missing_skills"] = []
        return subset[:top_n]

    by_index = {s.get("index"): s for s in scores if isinstance(s, dict)}
    ranked = []
    for i, j in enumerate(subset):
        s = by_index.get(i, {})
        j["match_score"] = s.get("match_score")
        j["matched_skills"] = s.get("matched_skills", [])[:5]
        j["missing_skills"] = s.get("missing_skills", [])[:4]
        j["match_reason"] = s.get("reason", "")
        # Hybrid rank fusion (research-backed): blend the LLM semantic score with
        # the deterministic lexical pre-rank position. Guards against LLM scoring
        # noise the same way RRF fuses lexical + vector retrieval.
        lexical_pos_score = 100 * (1 - i / max(len(subset), 1))
        llm_score = j["match_score"] if j["match_score"] is not None else 50
        j["_fused"] = 0.75 * llm_score + 0.25 * lexical_pos_score
        ranked.append(j)
    ranked.sort(key=lambda x: (x["match_score"] is None, -x["_fused"]))
    for j in ranked:
        j.pop("_fused", None)
    return ranked[:top_n]


async def smart_search(query: str | None, location: str, profile: dict | None,
                       resume_text: str | None, top_n: int = 12,
                       scrape_enrich: bool = True,
                       target_board: dict | None = None,
                       user_id: str | None = None,
                       conversation_id: str | None = None) -> dict:
    trace = []

    def log_step(step, detail):
        trace.append({
            "step": step,
            "detail": detail,
            "at": datetime.now(timezone.utc).isoformat(),
        })

    # 1. RETRIEVE MEMORY (if user_id provided)
    # ponytail: composed via memory_composer.compose_context — single prioritized,
    # token-budgeted string across working/procedural/episodic/semantic tiers,
    # replacing the two scattered helpers. Degrades to "" when DB/user absent.
    memory_context = ""
    preferences = None
    if user_id:
        from app.services.memory_composer import compose_context
        memory_context = await compose_context(user_id, query=(query or ""), conversation_id=conversation_id)
        preferences = await _load_user_preferences(user_id)  # kept for ranking-side use

    effective_query = (query or "").strip()
    if not effective_query:
        effective_query = await derive_query(profile, resume_text)
        log_step("PLAN", f"Derived search query from your profile/resume: '{effective_query}' "
                         f"(agent engine: {active_engine()})")
    else:
        log_step("PLAN", f"Using your query: '{effective_query}' (agent engine: {active_engine()})")

    # 2. REFINE QUERY (with memory augmentation)
    if memory_context:
        refined = await _refine_query_with_memory(effective_query, memory_context)
        if refined and refined.lower() != effective_query.lower():
            log_step("PLAN", f"Refined search query based on preferences: '{refined}'")
            effective_query = refined

    # Multi-query expansion: search related role formulations in parallel-ish
    queries = expand_queries(effective_query, profile)
    if len(queries) > 1:
        log_step("PLAN", f"Expanded into {len(queries)} query variants: "
                         + ", ".join(f"'{q}'" for q in queries))

    # Optional Hermes server-side scrape (WS-F): run the tiered scraper against
    # the target board hint, merge results BEFORE the existing dedupe/rank so
    # no duplicates leak through. Failure degrades to [] so the pipeline never
    # breaks when scraping is unavailable.
    hermes_jobs: list[dict] = []
    if scrape_enrich:
        hermes_jobs = await _hermes_scrape(effective_query, location, target_board)
        if hermes_jobs:
            log_step("GATHER", f"Hermes engine scraped {len(hermes_jobs)} jobs "
                               f"(board={target_board or 'auto'})")

    jobs = []
    seen = set()
    for q in queries:
        batch = await search_jobs(q, location)
        for j in batch:
            key = (j["title"].lower(), j["company"].lower())
            if key not in seen:
                seen.add(key)
                jobs.append(j)
    # Merge Hermes-scraped jobs through the same title+company dedupe.
    hermes_added = 0
    for j in hermes_jobs:
        key = (j["title"].lower(), j["company"].lower())
        if key not in seen:
            seen.add(key)
            jobs.append(j)
            hermes_added += 1
    log_step("GATHER", f"Fetched {len(jobs)} unique jobs "
                       f"(free providers + {hermes_added} Hermes-scraped) "
                       f"from Remotive, Arbeitnow, RemoteOK"
                       + (f" + Hermes" if hermes_added else ""))

    # Stage-1 hybrid retrieval: lexical + taxonomy + embeddings, RRF-fused
    jobs, method = await hybrid_prerank(jobs, profile, resume_text)
    log_step("PRERANK", f"Hybrid retrieval ranking ({method}) before AI scoring")

    candidate = _candidate_summary(profile, resume_text)
    ranked = await rank_jobs(candidate, jobs, top_n=top_n)
    
    # 4. RANK (with personal preference boost)
    if preferences:
        pref_titles = [t.lower() for t in (preferences.get("preferred_titles") or []) if t]
        pref_companies = [c.lower() for c in (preferences.get("preferred_companies") or []) if c]
        for j in ranked:
            boost = 0.0
            title = j.get("title", "").lower()
            company = j.get("company", "").lower()
            
            for pt in pref_titles:
                if pt in title:
                    boost += 10.0
                    break
            for pc in pref_companies:
                if pc in company:
                    boost += 15.0
                    break
            
            if boost > 0 and j.get("match_score") is not None:
                j["match_score"] = min(j["match_score"] + int(boost), 100)
                j["match_reason"] = (j.get("match_reason") or "") + f" (Boosted by {int(boost)}% based on your feedback)"

    scored = [j for j in ranked if j.get("match_score") is not None]
    log_step("RANK", f"AI scored {len(scored)} jobs against your profile")

    annotated = await annotate_jobs_with_ats(ranked)
    log_step("REPORT", f"Returning top {len(annotated)} matches sorted by fit")

    return {
        "query": effective_query,
        "location": location,
        "total_found": len(jobs),
        "engine": active_engine(),
        "results": annotated,
        "agent_trace": trace,
        "memory_used": bool(memory_context),
    }


async def _load_user_preferences(user_id: str) -> dict | None:
    """Load user preference summary from materialized view."""
    from app.services.db import get_pool
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM user_preference_summary WHERE user_id = $1",
                user_id
            )
            return dict(row) if row else None
    except Exception:
        return None


async def _load_conversation_context(conversation_id: str) -> str:
    """Load recent conversation messages for context."""
    from app.services.db import get_pool
    pool = await get_pool()
    if not pool:
        return ""
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT summary, messages FROM conversations WHERE id = $1",
                conversation_id
            )
            if not row:
                return ""
            if row['summary'] and row['summary'] != '[PENDING_SUMMARIZATION]':
                return row['summary']
            # Return last 6 messages
            messages = row['messages'][-6:] if len(row['messages']) > 6 else row['messages']
            return " | ".join(m.get('content', '')[:100] for m in messages)
    except Exception:
        return ""


async def _refine_query_with_memory(query: str, memory_context: str) -> str:
    """Refine target job search query with user history context."""
    try:
        prompt = (
            f"You are a job search assistant. Refine the search query based on the user's past preferences/history.\n"
            f"Original query: {query}\n"
            f"User History:\n{memory_context}\n"
            f"Provide a single refined search query (2-4 words) that incorporates their preferences. "
            f"Respond with ONLY the refined query text."
        )
        refined = await llm_complete(
            "You refine job search queries. Respond with ONLY the query text.",
            prompt,
            tier="fast"
        )
        return refined.strip().strip('"')[:60]
    except Exception as exc:
        logger.warning("Query refinement with memory failed: %s", exc)
        return query
