# Show HN Launch Package: Tayari

## Title Options
1. **Show HN: Tayari – Self-hosted AI job platform (local LLM, MCP server, never auto-submits)**
2. **Show HN: Tayari – Open-source job search assistant with local AI & ATS-safe resume builder**
3. **Show HN: Tayari – Local-first job intelligence engine with multi-armed bandit optimization**

## First Comment (Architecture & Technical Detail)

Hey HN! I built Tayari because existing job tools either suck your data into proprietary clouds or blindly spam application forms with low-quality resumes.

Tayari is a **self-hosted, local-first AI job platform** designed for job seekers who want full ownership over their career data and resume pipelines.

### Key Architecture Highlights
- **Strict Service Separation**: High-concurrency Go API Gateway (`backend/go/`) handles routing, auth, and billing metering, while Python (`backend/python/`) powers AI inference, Hermes web scraping, and Celery workers.
- **Local-First AI & MCP Integration**: Ships with native Model Context Protocol (MCP v2) support so Cursor, Claude Desktop, or your local LLM agents can query your job search pipeline directly via stdio/HTTP.
- **Outcome-Driven Multi-Armed Bandit**: Optimizes resume tailoring strategies (epsilon-greedy algorithm) with strict cold-start honesty gates (`n=20`).
- **ATS-Safe Typst PDF Compiler**: Compiles native Typst resumes with an inline "truth-gate" guardrail ("Tayari won't let you lie").
- **Zero-Auto-Submit Guarantee**: Automation engine prepares applications locally and stops at human review (`prepared` state) — it never submits without explicit human signoff.

### 60-Second Quickstart
```bash
git clone https://github.com/tayari-ai/tayari-skill-boost.git
cd tayari-skill-boost
docker compose --profile eval up -d
```

Open `http://localhost:5173` — all features run locally out of the box with zero external cloud requirements.

Repo: https://github.com/tayari-ai/tayari-skill-boost
Feedback, PRs, and self-hosted experience reports welcome!
