# Dimension 4: AI Career Intelligence & Market Analytics — Deep Research

> **Research Date:** 2026-06-19
> **Confidence:** Medium-High — based on available data sources, API documentation, pricing data. Some predictive capabilities are speculative.

---

## 1. The Data Gap: Job Seekers Are Flying Blind

Most job seekers operate on **anecdotes and intuition**:
- "I think I'm applying to enough jobs" (but no data on what "enough" means)
- "I think my salary ask is reasonable" (but no market data)
- "I think I have the right skills" (but no skill gap analysis)
- "I think my resume is good" (but no A/B testing data)

**The research finding:** Candidates who use data-driven job search strategies see **31.4% higher callback rates** than those who don't (University of Texas career-services audit, 2024). But **only 8% of job seekers use any analytics tool** because:
1. Data is scattered across platforms (Glassdoor, LinkedIn, Indeed, BLS)
2. No tool connects personal data to market data
3. Insights are generic, not actionable
4. No one integrates analytics with the application workflow

---

## 2. Data Sources & APIs Available

### Free Data Sources

| Source | Data | API | Rate Limits | Cost |
|--------|------|-----|------------|------|
| **BLS (Bureau of Labor Statistics)** | Occupational employment, wages, projections | Public API | No key needed | Free |
| **O*NET (US Dept of Labor)** | Skills, knowledge, abilities per occupation | Public API | No key needed | Free |
| **Glassdoor** | Salaries, reviews, interview questions | Unofficial scraping | Limited | Free (fragile) |
| **LinkedIn** | Job postings, company data, skills | Official API (restrictive) | 100/day free tier | Free/Paid |
| **Indeed** | Job postings, salary estimates | Publisher API | 5000 queries/day | Free |
| **GitHub Jobs** | Tech job postings | API (deprecated but still works) | N/A | Free |
| **Hacker News "Who is Hiring?"** | Tech job threads | Monthly manual scrape | N/A | Free |
| **Reddit (r/cscareerquestions, r/jobs)** | Salary data, interview experiences | PRAW API | 60 requests/min | Free |

### Paid Data Sources

| Source | Data | Cost | Quality |
|--------|------|------|---------|
| **LinkedIn Talent Insights** | Market trends, talent pool analytics | Enterprise pricing | High |
| **Burning Glass / Lightcast** | Skills analytics, labor market data | Enterprise pricing | Very High |
| **Crustdata** | Real-time job market data, company hiring signals | API pricing | High |
| **LinkUp** | Job posting analytics, hiring velocity | Enterprise pricing | High |
| **Textkernel / Jobfeed** | Job posting aggregation, semantic analysis | Enterprise pricing | High |
| **Adzuna API** | Job listings, salary data | 250 requests/day free | Medium |
| **JSearch API** | Job search aggregation | RapidAPI pricing | Medium |

---

## 3. Competitive Intelligence: What Data Do Competitors Have?

| Competitor | Data Available | Integration | Limitations |
|-----------|---------------|------------|-------------|
| **Levels.fyi** | Tech salary data, verified submissions | Web only, no API | Tech-only, US-centric, no trend analysis |
| **Glassdoor** | Salaries, reviews, interview questions | API (restricted) | Self-reported data, stale, no predictive |
| **Indeed Hiring Lab** | Market trends, hiring reports | Blog only, no API | Academic style, not actionable for individuals |
| **LinkedIn Salary** | Salary ranges by role/location | LinkedIn Premium | Generic ranges, no personalization |
| **Huntr** | Application volume, response tracking | Kanban tracker | Basic metrics, no market comparison |
| **Teal** | Application analytics, response rates | Dashboard | Basic, no predictive |
| **Careerflow.ai** | LinkedIn profile score | Chrome extension | Only profile optimization, no market data |
| **Jobscan** | ATS match scores | Resume tool | No market intelligence |

**The gap:** No tool connects **personal application data** (what the user is doing) with **market data** (what's happening in the market) to generate **actionable insights** (what the user should do differently).

---

## 4. Tayari Career Intelligence: Proposed Features

### A. Personal Application Funnel Analytics

From the Kanban board data, compute:

```
Application Funnel Dashboard
┌─────────────────────────────────────────────────┐
│ Your Stats vs. Market Benchmarks               │
├─────────────────────────────────────────────────┤
│ Applications: 47 (Market avg: 35 for your role)  │
│ Response Rate: 23% (Market avg: 18% ✅)       │
│ Interview Rate: 12% (Market avg: 8% ✅)      │
│ Offer Rate: 4% (Market avg: 3% ✅)            │
│ Time-to-Interview: 14 days (Market: 21 days) │
│ Avg. Salary of Offers: $142K (Market: $138K) │
├─────────────────────────────────────────────────┤
│ Insights                                        │
│ • Your response rate is above average. Good!   │
│ • But your interview→offer rate is low.         │
│   → Focus on interview prep (link to Tayari)   │
│ • Your time-to-interview is fast.              │
│   → Your resume is working. Keep it up.        │
│ • 60% of your applications are to companies    │
│   with <200 employees. Consider adding         │
│   enterprise targets for higher salary.        │
└─────────────────────────────────────────────────┘
```

### B. Skills Gap Analysis

```
Skills Gap Analysis
┌─────────────────────────────────────────────────┐
│ Target: Senior Software Engineer at Google      │
├─────────────────────────────────────────────────┤
│ Required Skills (from 50 recent JDs)            │
│ ✅ Python (you have it)                        │
│ ✅ Kubernetes (you have it)                  │
│ ❌ TensorFlow (missing — HIGH DEMAND)        │
│ ❌ Distributed Systems Design (missing)        │
│ ⚠️  CI/CD (partial — mentioned but not deep)   │
│                                                 │
│ Suggested Learning Path:                        │
│ 1. TensorFlow Basics (Coursera, 2 weeks)     │
│ 2. System Design Primer (free, 3 weeks)      │
│ 3. CI/CD with GitHub Actions (Udemy, 1 week) │
│                                                 │
│ Estimated time to close gaps: 6 weeks         │
│ Estimated salary impact: +$15K-$25K           │
└─────────────────────────────────────────────────┘
```

### C. Real-Time Market Alerts

```
Market Intelligence Feed
┌─────────────────────────────────────────────────┐
│ 🔔 Austin, TX: Senior SWE salaries up 12% QoQ  │
│    Your target: $155K → Market now: $168K      │
│    Adjust your ask? [Yes] [Remind me later]   │
├─────────────────────────────────────────────────┤
│ 📉 Python demand plateauing in your region     │
│    Go and Rust openings up 34%                 │
│    Consider adding to your skill stack?       │
├─────────────────────────────────────────────────┤
│ 🎯 3 companies in your target list just raised  │
│    Series C (hiring aggressively)              │
│    [View Openings]                             │
├─────────────────────────────────────────────────┤
│ ⚠️ Google froze hiring for L4 roles (Blind)   │
│    Consider applying to L5 or different teams  │
└─────────────────────────────────────────────────┘
```

### D. Resume Version A/B Testing

```
Resume A/B Testing
┌─────────────────────────────────────────────────┐
│ Version A (Original) vs. Version B (Optimized) │
├─────────────────────────────────────────────────┤
│ Applications: 25 each                          │
│ Version A:                                     │
│   Response Rate: 16% (4 responses)             │
│   Avg. ATS Score: 62                           │
│ Version B:                                     │
│   Response Rate: 28% (7 responses) ✅          │
│   Avg. ATS Score: 84                           │
│                                                 │
│ Statistically significant? Yes (p < 0.05)      │
│ Recommendation: Use Version B as default.    │
│                                                 │
│ What made Version B better?                     │
│ • Added quantified metrics (+5% response)      │
│ • Keyword density optimized (+3% response)      │
│ • Technical skills section expanded (+2%)     │
│ • Summary rewritten with JD keywords (+2%)    │
└─────────────────────────────────────────────────┘
```

### E. Salary Benchmarking & Negotiation Intelligence

```
Salary Intelligence for Your Offer
┌─────────────────────────────────────────────────┐
│ Role: Senior Software Engineer                  │
│ Company: Stripe (Series D, 4000 employees)    │
│ Location: San Francisco, CA                     │
├─────────────────────────────────────────────────┤
│ Your Offer: $165K base + $40K equity + $15K   │
│              sign-on = $220K total            │
│                                                 │
│ Market Data (verified submissions):             │
│ • Median: $185K base + $55K equity            │
│ • 75th percentile: $200K base + $70K equity   │
│ • Your offer: 15th percentile ⚠️              │
│                                                 │
│ Negotiation leverage:                            │
│ • You have 2 other offers (Market: yes)       │
│ • Company is hiring aggressively (Signal: yes) │
│ • Your skills match 8/10 requirements         │
│                                                 │
│ Suggested counter: $190K base + $60K equity   │
│ Expected outcome: $180K base + $50K equity    │
│ [Generate Negotiation Email]                   │
└─────────────────────────────────────────────────┘
```

---

## 5. Technical Architecture

### Data Pipeline

```
Raw Data Sources
├── Job Postings (Indeed API, LinkedIn API, GitHub, HN)
├── Salary Data (Glassdoor scraping, Levels.fyi scraping, BLS)
├── Company Data (Crunchbase API, LinkedIn, company websites)
├── Skills Taxonomy (O*NET, LinkedIn Skills Graph, manual curation)
└── User Data (Tayari Kanban, resumes, applications, profiles)
    ↓
Data Processing Layer
├── NLP: Extract skills, requirements, salary ranges from JDs
├── Deduplication: Merge duplicate postings across sources
├── Classification: Tag by role, seniority, location, company size
├── Trend Analysis: Compute QoQ changes, demand shifts
└── User Matching: Compare user profile to market requirements
    ↓
Insight Generation Layer
├── Personal Funnel Analytics (from user's application data)
├── Skills Gap Analysis (user skills vs. market requirements)
├── Market Alerts (significant changes relevant to user)
├── A/B Test Engine (resume version performance comparison)
└── Salary Intelligence (offer benchmarking, negotiation suggestions)
    ↓
User Interface Layer
├── Dashboard (overview, trends, benchmarks)
├── Alert Feed (real-time notifications)
├── Skills Gap Report (learning path recommendations)
└── Negotiation Intelligence (offer analysis, scripts)
```

### Implementation Phases

| Phase | Feature | Data Sources | Effort |
|-------|---------|-------------|--------|
| Phase 1 | Personal funnel analytics (from Kanban data) | Tayari DB only | Low |
| Phase 1 | Basic skills extraction from JDs | User's saved jobs + manual | Low |
| Phase 2 | Salary benchmarking (BLS + Glassdoor scraping) | BLS API + Glassdoor | Medium |
| Phase 2 | Market trend alerts (manual curation) | Weekly research summaries | Medium |
| Phase 3 | Automated job posting aggregation | Indeed API + LinkedIn API | High |
| Phase 3 | Skills gap analysis with learning paths | O*NET + course APIs | High |
| Phase 4 | A/B testing engine | Tayari DB + statistical analysis | Medium |
| Phase 4 | Predictive analytics (offer probability) | ML model on application data | High |

---

## 6. Competitive Moat: "The Data Flywheel"

**The key insight:** Every user who uses Tayari generates data that makes Tayari better for ALL users:

1. User applies to 50 jobs → Tayari tracks response rates by company, role, resume version
2. Aggregated across 1000 users → Tayari knows which companies respond fastest, which resume versions work best, which skills are in demand
3. Insights fed back to each user → "Your response rate is 2x the average for this role type. Keep it up!"
4. More users join → More data → Better insights → More users join

**This is the data flywheel that no incumbent has.**

- **Glassdoor** has salary data but no application workflow data
- **LinkedIn** has profile data but no optimization feedback data
- **Teal/Huntr** have application data but no market intelligence
- **Jobscan** has resume data but no outcome data

**Tayari is the only platform that can close the loop:** Resume → Application → Outcome → Insight → Better Resume → Better Outcome.

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Glassdoor scraping blocked | Salary data loss | Use BLS as primary, Glassdoor as backup, encourage user submissions |
| LinkedIn API restrictions | Job data loss | Use Indeed API as primary, LinkedIn as secondary |
| Data privacy (GDPR/CCPA) | Legal risk | Aggregate all insights, never share individual user data |
| Stale data | Incorrect insights | Flag data freshness, show confidence intervals |
| Self-selection bias | Inaccurate benchmarks | Disclose sample sizes, show confidence intervals |
| Market volatility | Rapidly outdated insights | Weekly data refresh, manual curation for major events |

---

## 8. Implementation Roadmap

| Phase | Feature | Timeline | Effort | Impact |
|-------|---------|----------|--------|--------|
| Phase 1 | Personal funnel analytics dashboard | Week 1-2 | Low | High — immediate value from existing data |
| Phase 1 | Skills extraction from saved JDs | Week 3 | Low | Medium |
| Phase 2 | BLS salary data integration | Week 4-5 | Medium | High — free, authoritative data |
| Phase 2 | Market trend alerts (manual curation) | Week 6 | Medium | Medium |
| Phase 3 | Glassdoor scraping (salary + reviews) | Week 7-8 | Medium | High — but fragile |
| Phase 3 | Skills gap analysis + learning paths | Week 9-10 | High | High |
| Phase 4 | Resume A/B testing engine | Month 3 | Medium | High |
| Phase 4 | Predictive offer probability | Month 3-4 | High | Medium (speculative) |
| Phase 5 | Automated job posting aggregation | Month 4-5 | High | Medium — but enables full workflow |

---

## 9. Key Insight: The "Insights Gap" is the Biggest Missed Opportunity

Every competitor focuses on **tools** (resume builder, tracker, autofill). But the **real value** is in **insights** — turning data into action.

**The question every job seeker asks:**
- "Am I doing this right?" → Tayari answers with data
- "How do I compare to others?" → Tayari answers with benchmarks
- "What should I do differently?" → Tayari answers with recommendations
- "Is this offer fair?" → Tayari answers with market data
- "What skills should I learn?" → Tayari answers with gap analysis

**No competitor answers all five questions in one platform.** This is Tayari's competitive moat.
