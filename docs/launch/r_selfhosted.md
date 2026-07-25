# Reddit r/selfhosted Launch Post

**Title**: **Tayari: Self-hosted AI job platform – local LLMs, MCP server, ATS resume compiler, 100% free for self-hosters**

Hey r/selfhosted!

I wanted to share **Tayari**, an open-source, self-hosted platform built for managing your entire job search locally without sending your resume or career history to third-party SaaS vendors.

### What it does:
1. **Self-Hosted Local Stack**: Go gateway + Python AI engine + PostgreSQL + Redis + Celery.
2. **Local LLM & MCP Integration**: Full Model Context Protocol (MCP v2) server interface for Cursor, Claude, or local Ollama instances.
3. **ATS Typst PDF Builder**: Generates single-column ATS-friendly resumes using Typst.
4. **Hermes Job Scraper**: Asynchronous background worker for web scraping job listings safely.
5. **No Blind Auto-Apply**: Prepares applications in a `prepared` state and halts for human review.

### Self-Hosters Policy
- `BILLING_ENABLED=false` by default. Self-hosted instances receive 100% free unlimited Pro features with zero billing popups or card requirements.

### Quickstart
```bash
docker compose --profile eval up -d
```

GitHub: https://github.com/tayari-ai/tayari-skill-boost
Docker Compose & deployment guides: `docs/deploy/`
