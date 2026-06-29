# Tayari Skill Boost — Go-to-Market Plan

> Date: 2026-06-30
> Grounded in: `TAYARI_COMPETITOR_ANALYSIS.md` §4.3, `research/DIFFERENTIATION_STRATEGY.md` §3.
> Positioning: **the chain, not the suite** — the only platform that runs resume → interview as one observable pipeline.

---

## 0. The wedge

The AI career-tools market is bifurcating between ATS specialists (Jobscan, Rezi) and all-in-one suites (Teal, Prentus). Both lanes are crowded and commoditizing. The unoccupied position is **AI-native career operating system that owns the whole chain with persistent memory and visible guardrails**. No competitor connects reflective resume optimization, tiered multi-board scraping, guardrail-gated apply assist, structured interview prep, and follow-up communication in one process graph — because each is a point solution.

We are not the suite. We are the chain.

---

## Phase 1 (Month 1–2): Resume Optimizer + Basic Job Search

**Target:** Active job seekers on Reddit (r/jobs, r/resumes, r/cscareerquestions), Hacker News (Show HN), Twitter/X (#OpenToWork, #jobsearch), LinkedIn.

**Hook:** *"Free ATS scan that actually works — with a per-ATS breakdown and a confidence band, not a single made-up number."*

**Why it lands:** Jobscan charges $49.95/mo for one ATS number. We give a more honest score (per-ATS + ±band) for free, plus a reflective optimizer that iterates against its own quality gate instead of one-shot GPT. The K2 per-ATS breakdown is the credibility wedge.

**Convert:** Free tier (3 scans/mo, 10 job searches/mo) → Pro $19/mo. Pro unlocks unlimited scans, full Hermes job search, interview prep, cover letters.

**Channels:**
- Show HN launch post (technical angle: self-hostable, local LLM, reflexion loop).
- Reddit: long-form "we open-sourced an ATS scorer that doesn't lie" in r/resumes + r/jobs. Lead with the methodology page (`/methodology`) citing Resumly/Ajusta/TalentTuner.
- Twitter/X: short demo of the observable chain (K1 activity chip → K5 chain strip).
- SEO: long-tail "honest ATS score", "resume optimizer that doesn't keyword-stuff", "self-hosted job search".

**KPIs (60 days):** 5K signups, 8% free→Pro conversion, 3 Show HN / Reddit posts in top-10 of the day.

---

## Phase 2 (Month 3–4): Interview Kanban + Communication Hub

**Target:** Phase 1 users + career coaches + bootcamp grads (need tracking + follow-up).

**Hook:** *"Never lose track of an application again — and never send a generic follow-up again."*

**Why it lands:** Teal/Huntr own visual Kanban but have zero AI. We surface the K5 chain strip (resume → ATS → optimize → jobs → cover → apply → interview → comms) as the product's spine, and the K4 Apply Assist gates every submit behind a visible authenticity check (stuffing/PII/truthfulness). This is the "AI-tailored, not blast-bot" trust position.

**Convert:** Pro retention + Team tier ($49/user/mo) for bootcamps/coaches running shared candidate pipelines.

**Channels:**
- Career coach partnerships (affiliate): coaches get Team dashboards, we get distribution.
- Bootcamp outbound: shared review queue + bulk optimization as the enterprise wedge.
- Case studies: "from 0 callbacks to 4 interviews in 3 weeks using the chain."

**KPIs (120 days):** 20K MAU, 12% Pro conversion, 10 Team accounts, 40% 30-day retention.

---

## Phase 3 (Month 5–6): Memory Layer + Browser Extension

**Target:** Power users + enterprise/gov (EU GDPR, India data-sovereignty).

**Hook:** *"AI that remembers what you want — and runs on your own infrastructure."*

**Why it lands:** Persistent memory (conversations + episodic + semantic + learned preferences) is the one feature **zero competitors have** — every other tool is stateless per request. Combined with self-hosted + local LLM (Ollama), this opens enterprise/gov segments with no direct competitor.

**Convert:** Enterprise self-hosted licenses + Team tier expansion. Memory becomes the retention moat — once the AI has learned your preferences, switching cost is real.

**Channels:**
- Enterprise outbound (GDPR/data-sovereignty angle): "zero data leaves your machine" deck.
- Open-source community: the repo is the funnel for self-hosters; cloud-hosted is the upsell.
- Browser extension launch (Chrome Web Store) — K3 skill-gap widget + review queue from any ATS site.

**KPIs (180 days):** 50K MAU, 5 enterprise pilots, 15% Pro→Team expansion, 35% 7-day retention (memory-driven).

---

## Pricing rationale

| Tier | Price | Why |
|---|---|---|
| Free | $0 | 3 scans/mo, 10 searches/mo, basic tracker. Funnel top. |
| Pro | $19/mo | Undercuts Jobscan ($49.95) with 10× features; matches Teal's price point with superior AI. |
| Team | $49/user/mo | Bootcamps/coaches/enterprise collaboration. Competes with Huntr $10 but adds the full AI chain. |

See `research/PRICING.md` for the full competitive logic.

---

## Technical differentiators to lead every asset with

1. Reflective resume optimization (reflexion loop) — no competitor has this.
2. Hermes tiered multi-board pipeline with circuit breakers — "10+ boards, works with zero keys".
3. Hybrid RRF ranking — three independent rankers fused.
4. Knowledge graph extraction — enterprise HR feature, self-hosted.
5. Persistent AI memory — stateless competitors can't match.

Plus the trust moat: **visible guardrails before every submit** (keyword-stuffing, PII, truthfulness).

---

## What we deliberately don't compete on (this quarter)

- Voice/video interview AI (Final Round AI owns it at 4.5★ — not worth the fight).
- Resume builder from scratch (Enhancv/Kickresume are design-first; we're analysis-first).
- Mobile app (PWA is enough until Huntr's mobile wins our segment).

Revisit only if: voice after InterviewBoard retention is measurable; builder if free→Pro conversion < 6%; mobile if PWA install rate > 15%.