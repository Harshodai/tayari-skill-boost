# Competitive Brief — Knowledge Graph / Skill Ontology

**Research date:** 2026-07-28. **Method:** web search (see sources per section) + direct code inspection of Tayari's implementation. No scraping of competitor sites/reviews/job postings performed — pricing and architecture claims are from public engineering blogs, review aggregators, and vendor pricing pages found via search.

## 1. Executive Summary

No competitor in Tayari's actual price tier ($10-50/mo, consumer job-seeker) ships a real skills ontology or knowledge graph — Teal, Jobscan, and ResumeWorded all compete on keyword/ATS match rate. The players who *do* have real graphs (Eightfold, Beamery, Phenom, LinkedIn) are enterprise HR platforms priced at $10K-750K/yr, solving a different problem (talent acquisition/workforce planning, not individual resume optimization). **Biggest opportunity:** the whitespace is real. **Biggest threat:** Tayari's current implementation is smaller and less rigorous than the free public taxonomies it doesn't use (88 hand-written skills vs ESCO's 13,939), and the "$50K-750K/yr enterprise parity" claim already in `README.md`/`PRODUCT_GRILL.md` invites direct comparison to systems that are architecturally more sophisticated (RDF ontologies, deep-learning matching engines) than what's shipped.

## 2. Competitor Profiles

### Eightfold.ai
- **What they do:** AI talent intelligence platform — matches candidates to roles by reasoning about skills present, likely, and acquirable (not keyword match).
- **Tech:** Deep-learning model trained on 1.6B career profiles, ~1.6M inferred skills.
- **Scope:** Full talent lifecycle — external hiring, internal mobility, workforce planning, contingent workforce.
- **2026 development:** Added "AI Interviewer" (autonomous candidate interviews) and "Interview Companion."
- **Pricing:** Enterprise, not public — historically $50K+/yr per PRODUCT_GRILL.md's existing citation.
- Sources: [Knowlee](https://www.knowlee.ai/blog/ai-talent-intelligence) · [hraitoolskit](https://hraitoolskit.com/articles/eightfold-ai-review/) · [CX Everywhere](https://cxeverywhere.com/tools/eightfold-ai-review/)

### Beamery
- **What they do:** Talent CRM / "Talent Graph" for enterprise recruiting and workforce planning.
- **Tech — closest analog to what Tayari claims:** RDF/semantic-web knowledge graph, ~16,000 canonical skills normalized from ~20M raw unnormalized skill strings extracted from source data. Strongly-typed ontology (pseudo-ontology, internally called SARO) with data provenance tracking. Skills modeled from both supply (talent) and demand (job) sides.
- **Why this matters for Tayari:** this is a real, materially bigger, differently-architected system than a JSONB blob + regex extractor — the gap between "Beamery's graph" and "Tayari's Knowledge Graph" is not incremental.
- Sources: [Beamery eng blog pt.1](https://medium.com/hacking-talent/skills-beamery-part-1-representing-skills-for-today-and-the-unknown-of-tomorrow-d87e114771a3) · [pt.2](https://medium.com/hacking-talent/skills-beamery-part-2-disaggregating-a-skill-72fa4f4d1cfa) · [ODSC talk](https://odsc.com/speakers/a-global-knowledge-graph-of-people-skills-and-companies-how-ontology-design-is-key-to-enabling-ai-solutions-in-hr/)

### Phenom
- **What they do:** Talent Experience Management (TXM) — candidate/employee/recruiter/manager experience suite, skills-graph-driven internal mobility and gap analysis.
- **Customers:** SAP, Deloitte, Michelin — enterprise, 1,000+ employee target.
- **Pricing:** ~$10K/mo+ starting, $7-13 PEPM, annual contracts often $100K+, plus implementation cost.
- Sources: [paraform](https://www.paraform.com/blog/phenom-pricing-2025) · [selecthub](https://www.selecthub.com/p/talent-acquisition-software/phenom/) · [industrylabs](https://www.industrylabs.ai/articles/phenom-review)

### LinkedIn Skills Graph / Economic Graph
- **What they do:** Powers skills-based search, job recommendations, and labor-market insights (Economic Graph) across LinkedIn.
- **Tech:** Graph with 39K skill nodes, 875M people, 59M companies. Skills linked via manually-curated "knowledge lineages" (parent/child edges) — taxonomists assign relationships with ML-model output as a decision aid, not full automation.
- **Notable:** even the largest player in this space hasn't fully automated ontology curation — human taxonomists are still in the loop.
- Sources: [LinkedIn eng — Skills Graph](https://www.linkedin.com/blog/engineering/skills-graph/building-linkedin-s-skills-graph-to-power-a-skills-first-world) · [LinkedIn eng — taxonomy](https://www.linkedin.com/blog/engineering/data/building-maintaining-the-skills-taxonomy-that-powers-linkedins-skills-graph)

### Teal / Jobscan / ResumeWorded (consumer tier — Tayari's actual competitive set)
- **Pricing:** Teal $10-20/mo (AI features paywalled at $29/mo), Jobscan $49.95/mo, ResumeWorded $19/mo.
- **Tech:** Keyword/ATS match-rate scoring. **None market a knowledge graph, ontology, or skills-graph feature.**
- Sources: [jobscan.co blog](https://www.jobscan.co/blog/jobscan-vs-teal/) · [resumeup.ai](https://resumeup.ai/jobscan-vs-teal) · [landthisjob.com](https://landthisjob.com/best-resume-tools/)

## 3. Comparison Matrix

| Dimension | Tayari (as shipped) | Eightfold | Beamery | Phenom | LinkedIn | Teal/Jobscan/ResumeWorded |
|---|---|---|---|---|---|---|
| Has a graph/ontology at all | Claimed, not really (see §4) | ✅ deep-learning graph | ✅ RDF ontology | ✅ skills graph | ✅ 39K-node graph | ❌ |
| Canonical skill count | 88 (hand-written) | ~1.6M inferred | ~16,000 curated | Not public | 39,000 | n/a |
| Extraction method | Regex/keyword | Deep learning | ML + human taxonomists | ML | ML + human taxonomists | Keyword match |
| Price tier | $0-30/mo (self-hosted target) | Enterprise (six figures) | Enterprise | $10K+/mo | N/A (platform feature) | $10-50/mo |
| Typed/validated output contract | No — `Dict[str,Any]` (see COMPETITIVE_BRIEF gap below) | Proprietary | RDF-typed | Proprietary | Typed graph schema | n/a |

## 4. Gap Analysis — What "Unique" Actually Requires

Tayari's implementation, verified in code during this audit:
1. `knowledge_graph.py` — 139 lines of regex/keyword matching, no graph structure.
2. `resume_graph.py` — separate storage API, one JSONB blob per resume, not a graph schema.
3. `skill_taxonomy.py` — 88 hand-curated canonical skills. ESCO (free, EU) has 13,939. O\*NET (free, US) similarly extensive. Tayari is smaller than the free public option it didn't adopt.
4. `KnowledgeGraphResponse` schema (`schemas.py:234`) — fields typed `Dict[str, Any]`, which validates nothing. Not even wired to its own endpoint (`main.py:547` returns the raw extractor dict, ignoring the schema).
5. One of the two entry points (`handleResumeKnowledgeGraph`) 404s — dead route, never registered in `router.go`.

## 5. Opportunities

- **Real whitespace confirmed:** no tool in Tayari's actual price bracket has a graph. If built for real, Tayari would be the only self-hosted, consumer-priced tool with genuine skill-relationship modeling.
- **Free foundation available:** ESCO (13,939 skills, multilingual, versioned, open API/JSON-LD) and O\*NET (US, free) mean the ontology doesn't need to be built from scratch — seed from these instead of hand-typing 88 entries.
- **Structured-LLM-output tooling matured:** [Instructor](https://python.useinstructor.com/) (Pydantic-based, 3M downloads/mo) + native Claude structured outputs (GA since Feb 2026) make schema-enforced extraction a solved problem, not a research project.

## 6. Threats

- **Overclaiming before earning it.** `README.md`/`PRODUCT_GRILL.md` already cite the $50K-750K/yr enterprise-HR-parity framing. Any technical reviewer, competitor, or sophisticated customer comparing Tayari's actual code (regex + JSONB blob) to that claim will find the gap immediately — the claim is currently a liability, not an asset.
- **The "graph" label describes three disconnected things**, one of which 404s. If this ships as-marketed and a user or partner inspects it, the finding is "vaporware," not "hidden gem."

## 7. Recommended Actions

**Quick wins (do first):**
1. Register `handleResumeKnowledgeGraph` under both `/api` and `/api/v1` using the shared route-registration helper that creates both aliases (satisfying route parity).
2. Stop citing $50K-750K/yr parity in marketing copy until items below land — the claim actively invites the comparison that currently fails.

**Strategic (the actual moat, in order):**
3. Seed `skill_taxonomy.py` from ESCO (free, 13,939 skills) instead of the current 88.
4. Replace `Dict[str, Any]` in `KnowledgeGraphResponse` with typed Pydantic models; wire `response_model=`; adopt Instructor or native Claude structured outputs for LLM-path extraction.
5. Decide whether `knowledge_graph.py` (extraction) and `resume_graph.py` (storage) become one coherent graph system or stay explicitly separate and differently named.
6. Only then re-introduce the enterprise-parity claim — with the receipts to back it (real skill count, typed contract, working route).

---
Would you like: a battlecard for sales/landing-page copy specifically, or a deeper dive into any one competitor (e.g. Beamery's RDF schema design in more detail)?
