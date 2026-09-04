# Tayari Skill Boost — Pricing Strategy

> Date: 2026-06-30
> Grounded in: `TAYARI_COMPETITOR_ANALYSIS.md` §4.2, `research/GO_TO_MARKET.md`.
> Principle: undercut the ATS specialist on price, beat the suite on features, own the chain on positioning.

---

## Tiers

| Tier | Price | Audience | Feature envelope |
|---|---|---|---|
| **Free** | $0 | Funnel top, casual seekers | 3 resume scans/mo, 10 job searches/mo, basic tracker, basic ATS score |
| **Pro** | $19/mo (billed annually) | Active job seekers | Unlimited scans, full Hermes job search, per-ATS breakdown + confidence band, reflective optimizer, AI cover letters, STAR interview prep, 50 tailored applications/mo |
| **Team** | $49/user/mo (billed annually) | Bootcamps, career coaches, enterprise | Everything in Pro + shared candidate pipelines, team review queue, admin dashboard, bulk optimization, Hermes multi-board scraping, dedicated account manager |

---

## Competitive logic

**Jobscan = $49.95/mo** for a single ATS number, no job search, no tracking, no interview prep. We give a *more honest* score (per-ATS + confidence band) plus the entire chain for **$19** — roughly 38% of Jobscan's price for 10× the surface area. The Pro tier is the no-brainer upgrade.

**Teal = $9/wk (~$39/mo)** for tracking + basic ATS. We match Teal's "all-in-one" promise but ship the AI it lacks (reflexion loop, knowledge graph, memory) at ~half the monthly cost when billed annually.

**Huntr = $10/mo** for a beautiful Kanban with zero AI. Team tier at $49/user competes on the AI chain + collaboration, not on tracker prettiness — Huntr users upgrade for the optimizer + apply assist + interview prep they don't have.

**Rezi = $29/mo** ATS-first templates, no search/tracking. Pro at $19 undercuts with strictly more capability.

**Prentus = $15/mo** voice interview AI. We don't compete on voice (per GTM §"don't compete on"); Pro at $19 wins on the chain Prentus lacks.

---

## Why Free is generous

3 scans + 10 searches/mo is enough to feel the value (a real per-ATS breakdown, a real reflective optimization) but not enough to live on. The upgrade trigger is volume + the Hermes job search + interview prep, which are Pro-gated. Conversion target: 8% free→Pro in Phase 1, 12% by Phase 2.

---

## Why Team at $49/user

Bootcamps and coaches currently duct-tape Huntr + Jobscan + a shared spreadsheet. We replace all three with one observable pipeline + a shared review queue + bulk optimization. $49/user is below the per-seat cost of the duct-tape stack and above the $19 Pro floor enough to fund account management. Enterprise self-hosted licenses priced separately (contact sales).

---

## Money-back + cancellation

- 7-day money-back guarantee on Pro/Team (already on `Pricing.tsx`).
- One-click cancel from profile settings — no retention dark patterns. This is a trust signal in a category (auto-apply) where trust is the bottleneck (`DIFFERENTIATION_STRATEGY.md` K4).

---

## What we don't charge for yet

- Browser extension (free, top-of-funnel).
- Self-hosted / local-LLM mode (open-source — the repo IS the funnel; cloud-hosted is the upsell).
- API access as a service (untapped per `DIFFERENTIATION_STRATEGY.md` — monetize after Phase 3 once usage signals a ceiling).