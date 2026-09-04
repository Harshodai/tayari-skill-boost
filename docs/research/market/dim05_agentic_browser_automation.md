# DIM-05: AI Agentic Browser Automation Research Document

**Tayari Job Search Platform — Research Initiative**
**Date:** 2026-06-20
**Research Lead:** AI Research Sub-Agent
**Status:** Comprehensive Feasibility Assessment

---

## Executive Summary

Building an AI agentic browser automation system for job application submission is technically feasible today, but requires careful architecture to balance automation power with safety, compliance, and user trust. The landscape has matured dramatically between 2024-2026, with open-source frameworks like **Browser-Use** (97,000+ GitHub stars), **Skyvern** (20,000+ GitHub stars), and **Crawl4AI** (46,000–68,000+ GitHub stars) providing production-ready foundations. Cloud-native alternatives like **rtrvr.ai** demonstrate that the job application automation market is viable and growing.

**Key Findings:**

1. **Browser-Use** is the strongest open-source candidate for Tayari's Python FastAPI backend — it is model-agnostic, built on Playwright (which Tayari already uses), achieves 89.1% success rate on the WebVoyager benchmark, and supports DOM-distillation for lower token costs.

2. **Skyvern** excels at form-filling workflows (best-in-class for WRITE tasks), offers built-in CAPTCHA solving, 2FA support, and a no-code workflow builder — making it ideal for complex multi-page ATS forms like Workday.

3. **Crawl4AI** is the optimal choice for job description scraping and extraction (not form submission), producing LLM-ready markdown with BM25 filtering and structured JSON output.

4. **Competitive tools** (FastApply, LoopCV, LazyApply, Simplify.jobs, rtrvr.ai) all suffer from the same limitations: Workday handling is unreliable (~50% accuracy), LinkedIn bot detection is a real risk, and most lack robust review-before-submit guardrails.

5. **The biggest exploitable gap:** No competitor combines AI-powered application preparation with a **mandatory human review checkpoint** before final submission, plus **platform-aware rate limiting** and **duplicate detection** at the same time. This is Tayari's differentiation opportunity.

6. **Anti-bot detection is the #1 production risk.** LinkedIn actively flags automation. Workday has anti-bot measures. The solution is a hybrid architecture: Tayari's existing Chrome extension (user's own browser session) for LinkedIn/Indeed, and cloud-hosted agents (Browser-Use/Skyvern) for company ATS portals (Greenhouse, Lever, Ashby, Workday).

**Recommended Approach:** A phased rollout starting with a **Chrome Extension + Human-in-the-Loop** MVP for LinkedIn Easy Apply and Greenhouse, then expanding to cloud-hosted agents for Workday and custom portals.

---

## Technology Landscape

### 1. Browser-Use (browser-use/browser-use)

| Attribute | Detail |
|---|---|
| **GitHub** | https://github.com/browser-use/browser-use |
| **Stars** | 97,000+ (as of early 2026) |
| **License** | MIT |
| **Language** | Python (Rust core in v0.13+) |
| **Backend** | Playwright |
| **Benchmark** | 89.1% on WebVoyager (586 tasks) |
| **Pricing** | Free + LLM API costs |

**Architecture:** Browser-Use provides a Python API that feeds distilled DOM observations or screenshots to an LLM, which reasons about the next action (click, type, scroll, navigate). The LLM returns a structured action, Browser-Use executes it via Playwright, and the loop continues until the task is complete.

**Key Features:**
- **Model Agnostic:** Works with OpenAI, Anthropic, Google, Azure, Ollama, and any LiteLLM-compatible provider — critical for Tayari's Ollama/local LLM support.
- **DOM Distillation:** Strips pages to essential interactive elements, reducing token consumption by 5–10x compared to screenshot-only approaches.
- **Multi-tab Support:** Agents can work across tabs.
- **Browser Profiles:** Persistent cookies, allowed domains, headless/headed mode.
- **Action Space:** `click`, `input_text`, `scroll`, `navigate`, `wait`, `extract_content`, `switch_tab`, `done`.

**Quick Start (Python):**

```python
from browser_use.beta import Agent, BrowserProfile, ChatBrowserUse
import asyncio

async def apply_to_job():
    agent = Agent(
        task=(
            "Apply to the job at this URL. Fill out all required fields using:\n"
            "- Name: John Doe\n"
            "- Email: john@example.com\n"
            "- Phone: 555-123-4567\n"
            "- Upload resume from /tmp/resume.pdf\n"
            "- Stop at the final review/submit page and report back what would be submitted."
        ),
        llm=ChatBrowserUse(model="openai/gpt-5.5"),  # or local Ollama
        browser_profile=BrowserProfile(
            headless=False,
            allowed_domains=["*.greenhouse.io", "*.lever.co", "*.linkedin.com"],
        ),
    )
    history = await agent.run()
    return history.final_result()

asyncio.run(apply_to_job())
```

**Limitations:**
- No built-in CAPTCHA solver (must integrate external service or human-in-the-loop).
- No native workflow builder — all logic is code/Prompt-driven.
- Infrastructure management (browser pools, proxies, memory) is your responsibility.
- Each step consumes LLM tokens; costs add up for long workflows.

---

### 2. Skyvern (Skyvern-AI/skyvern)

| Attribute | Detail |
|---|---|
| **GitHub** | https://github.com/Skyvern-AI/skyvern |
| **Stars** | ~20,000+ (as of mid-2026) |
| **License** | Open Source |
| **Language** | Python / TypeScript SDK |
| **Backend** | Playwright + LLM + Computer Vision |
| **Benchmark** | 64.4% on WebBench (best for WRITE tasks) |
| **Pricing** | Open source + managed Cloud tier |

**Architecture:** Skyvern uses a **swarm of agents** to comprehend a website, plan actions, and execute them. It combines LLM reasoning with computer vision (screenshots) to identify elements visually and semantically, rather than relying on brittle CSS selectors.

**Key Features:**
- **AI-Powered Page Commands:** `page.act()`, `page.extract()`, `page.validate()`, `page.prompt()`
- **No-Code Workflow Builder:** Visual workflow construction with browser tasks, loops, conditionals, file parsing, email sending.
- **CAPTCHA Solving:** Built-in CAPTCHA handling (via cloud or integrated solvers).
- **2FA Support:** TOTP (Google Authenticator/Authy), email 2FA, SMS 2FA.
- **Authentication Integrations:** Bitwarden, 1Password, LastPass, custom credential API.
- **Livestreaming:** Real-time viewport streaming for debugging and human oversight.
- **File Downloading:** Automatic file handling with block storage upload.
- **MCP Support:** Model Context Protocol for integration with any MCP-compatible client.

**Quick Start (Python SDK):**

```python
from skyvern import SkyvernClient

client = SkyvernClient(api_key="sk-...")

# Create a task
task = await client.create_task(
    url="https://boards.greenhouse.io/tayari/jobs/12345",
    prompt=(
        "Fill out the job application form with the following details:\n"
        "- Full Name: John Doe\n"
        "- Email: john@example.com\n"
        "- Resume: upload from /tmp/resume.pdf\n"
        "- Cover Letter: Use the tailored version for software engineer roles\n"
        "- Do NOT click the final submit button. Stop at the review page."
    ),
    data_extraction_schema={
        "type": "object",
        "properties": {
            "fields_filled": {"type": "array", "items": {"type": "string"}},
            "uploaded_files": {"type": "array", "items": {"type": "string"}},
            "submit_button_found": {"type": "boolean"}
        }
    }
)

result = await client.wait_for_task(task.task_id)
print(result.extracted_information)
```

**Why Skyvern for Tayari:**
- Best-in-class for **WRITE tasks** (form filling, file uploads, multi-page wizards) — exactly what job applications require.
- Built-in **CAPTCHA solving** and **2FA** reduce human interruption points.
- **Livestreaming** enables real-time human monitoring during application runs.
- **Workflow builder** allows non-engineers to define application templates per platform.

---

### 3. Crawl4AI (unclecode/crawl4ai)

| Attribute | Detail |
|---|---|
| **GitHub** | https://github.com/unclecode/crawl4ai |
| **Stars** | 46,000–68,000+ (rapid growth in 2024–2025) |
| **License** | Apache 2.0 |
| **Language** | Python |
| **Backend** | Playwright (optional) for JS rendering |
| **Pricing** | Free (open source) |

**Architecture:** Crawl4AI is a Python-first web crawler optimized for LLM/RAG pipelines. It converts web pages into clean markdown, supports structured JSON extraction via LLM prompts, and handles multi-page crawling with async parallelism.

**Key Features:**
- **Clean Markdown Output:** Removes nav, footers, ads, cookie banners — perfect for feeding job descriptions to LLMs.
- **Structured Extraction:** LLM-based or CSS/XPath-based extraction with JSON schema enforcement.
- **BM25 Filtering:** Content filtering to extract only sections relevant to query terms (e.g., "requirements", "qualifications").
- **Parallel Crawling:** Async batch processing of URLs.
- **Session Management:** Cookie persistence, proxy support, stealth mode.
- **Local LLM Support:** Works with Ollama via LiteLLM.

**Quick Start:**

```python
import asyncio
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from crawl4ai.extraction_strategy import LLMExtractionStrategy

async def scrape_job_description(url: str):
    llm_strategy = LLMExtractionStrategy(
        provider="openai/gpt-4o-mini",  # or "ollama/llama3.2"
        instruction=(
            "Extract the following from this job posting:\n"
            "- Job title\n"
            "- Company name\n"
            "- Required skills (list)\n"
            "- Years of experience required\n"
            "- Key responsibilities (bullet points)\n"
            "- Application deadline if visible\n"
            "- ATS platform (Greenhouse, Lever, Workday, etc.) if detectable"
        ),
        schema={
            "title": "string",
            "company": "string",
            "required_skills": ["string"],
            "experience_years": "string",
            "responsibilities": ["string"],
            "deadline": "string",
            "ats_platform": "string"
        }
    )

    run_config = CrawlerRunConfig(
        browser_config=BrowserConfig(headless=True),
        extraction_strategy=llm_strategy
    )

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url, config=run_config)
        return result.extracted_content

# Batch scrape multiple job URLs
urls = [
    "https://boards.greenhouse.io/company/jobs/123",
    "https://jobs.lever.co/company/abc-def",
    "https://company.wd101.myworkdayjobs.com/en-US/job/123"
]
results = asyncio.gather(*[scrape_job_description(url) for url in urls])
```

**Tayari Use Case:** Crawl4AI should be Tayari's **job description ingestion pipeline** — NOT the form submission engine. It feeds structured job requirements into the resume/cover letter tailoring system.

---

### 4. rtrvr.ai (Competitive Reference)

| Attribute | Detail |
|---|---|
| **Website** | https://www.rtrvr.ai |
| **Type** | Chrome Extension + Cloud Platform + WhatsApp Bot + API |
| **Pricing** | Free tier + ~$49/mo Starter, ~$149/mo Growth |
| **Approach** | Smart DOM Trees + 20+ specialized sub-agents |

**Key Differentiators:**
- **Smart DOM Trees:** Proprietary text-based DOM representation (not screenshots) that captures all interactive elements and information.
- **20+ Sub-Agents:** Master planner orchestrates specialized agents for action, extraction, crawling, PDF parsing, form filling.
- **Extension-First:** Runs in user's own browser with their authenticated sessions — bypassing many anti-bot measures.
- **DOM Recordings:** Text-based workflow recordings that replay perfectly even when visual layouts change.
- **Review Before Submit:** Supports pause-for-review configuration (explicitly mentioned in their job application use case).

**User Complaints (from Chrome Web Store reviews):**
- Sign-in/signup failures
- Cluttered/hard-to-use UI
- Reliability issues, inconsistent results, parsing errors
- Chrome-only (no Edge/Brave support)
- Hit-or-miss on complex forms

**Tayari Lesson:** rtrvr.ai proves the market exists but also shows that UX polish, reliability, and platform coverage breadth are major gaps to exploit.

---

### 5. Playwright MCP (Microsoft/Anthropic Standard)

**What it is:** Model Context Protocol (MCP) is an open standard created by Anthropic and adopted by Microsoft for Playwright. It provides a standardized bridge between LLMs and Playwright browser functions.

**Tools Exposed:**
- `browser_navigate` — navigate to URL
- `browser_snapshot` — accessibility tree snapshot (LLM-friendly DOM)
- `browser_click_text` — click element by visible text
- `browser_click_element` — click by accessibility ID
- `browser_type` — type into input fields
- `browser_select_option` — select dropdown options
- `browser_take_screenshot` — capture screenshot

**Code Pattern:**

```python
# Playwright MCP via Python asyncio
async with ClientSession(*stdio) as session:
    await session.initialize()
    tools = await session.list_tools()

    # Navigate
    await session.call_tool("browser_navigate", {"url": "https://linkedin.com/jobs"})

    # Get accessibility snapshot (structured text/ARIA data)
    snapshot = await session.call_tool("browser_snapshot", {})

    # Click by text
    await session.call_tool("browser_click_text", {"text": "Easy Apply"})

    # Fill form field
    await session.call_tool("browser_type", {
        "element": "Full name",
        "text": "John Doe"
    })
```

**Tayari Use Case:** Playwright MCP is the **lowest-level building block**. Tayari could use it directly if building a fully custom agent, but Browser-Use and Skyvern provide higher-level abstractions that reduce development time. MCP is most useful if Tayari wants to support Claude Desktop, Cursor, or other MCP-native clients as frontends.

---

### 6. Other Notable Tools

| Tool | Stars | Best For | Notes |
|---|---|---|---|
| **Firecrawl** | 130,000+ | Web data layer for AI apps | Managed API, not form filling. Good for job description scraping at scale. |
| **Stagehand** | 23,000+ | TypeScript devs, Playwright+AI | `act()`, `extract()`, `observe()` primitives. Browserbase integration. No Python SDK. |
| **Agent Browser** | 35,000+ | CLI-first browser control | Rust-native, semantic element finding, multi-session. Less suited for web apps. |
| **Browserbase** | N/A | Managed browser infrastructure | Cloud-hosted browsers. Usage-based pricing. Good for scaling. |
| **ScrapeGraphAI** | N/A | Natural language scraping graphs | Graph logic + LLMs. Integrates with Ollama. Good for extraction, not interaction. |

---

## Technical Feasibility Analysis

### 1. Integration with Python FastAPI Backend

**Feasibility: HIGH** ✅

Both Browser-Use and Skyvern are Python-native and can run as background tasks within or alongside Tayari's existing FastAPI backend (port 8000).

**Recommended Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Tayari Python FastAPI                      │
│                      (Port 8000)                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Resume API │  │  Job Scrape │  │  Application Agent  │  │
│  │  (Existing) │  │  (Crawl4AI) │  │  (Browser-Use/      │  │
│  │             │  │             │  │   Skyvern)          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │              │
│  ┌──────┴────────────────┴────────────────────┴──────────┐  │
│  │              Task Queue (Celery + Redis)                 │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │      Browser Pool         │
              │  (Playwright instances)   │
              │   - Browser-Use agents    │
              │   - Skyvern workflows     │
              │   - Proxy rotation        │
              └───────────────────────────┘
```

**Celery Task Pseudocode:**

```python
# tasks.py
from celery import Celery
from browser_use.beta import Agent, BrowserProfile, ChatBrowserUse
from skyvern import SkyvernClient
import asyncio

app = Celery("tayari", broker="redis://localhost:6379/0")

@app.task(bind=True, max_retries=3)
def run_application_agent(self, job_url: str, user_id: str, resume_id: str):
    """
    Celery task that runs the browser agent for a single job application.
    Stops at review checkpoint — does NOT submit.
    """
    try:
        # 1. Load user profile and tailored resume from DB
        user_profile = get_user_profile(user_id)
        tailored_resume = get_tailored_resume(resume_id)

        # 2. Detect platform from URL
        platform = detect_platform(job_url)

        # 3. Build platform-specific prompt
        prompt = build_application_prompt(
            platform=platform,
            profile=user_profile,
            resume_path=tailored_resume.file_path,
            job_url=job_url
        )

        # 4. Run agent (Browser-Use example)
        async def execute():
            agent = Agent(
                task=prompt,
                llm=ChatBrowserUse(model="ollama/llama3.2"),  # Local fallback
                browser_profile=BrowserProfile(
                    headless=True,
                    allowed_domains=get_allowed_domains(platform),
                ),
            )
            return await agent.run()

        result = asyncio.run(execute())

        # 5. Save to review queue (NOT submitted yet)
        review_entry = save_to_review_queue(
            user_id=user_id,
            job_url=job_url,
            platform=platform,
            agent_result=result,
            status="pending_review"
        )

        # 6. Notify frontend via WebSocket / SSE
        notify_user(user_id, {
            "type": "application_ready_for_review",
            "review_id": review_entry.id,
            "job_url": job_url,
            "preview": generate_submission_preview(result)
        })

        return {"status": "pending_review", "review_id": review_entry.id}

    except Exception as exc:
        # Retry with exponential backoff
        if self.request.retries < 3:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

        # Log failure for analysis
        log_application_failure(user_id, job_url, exc)
        return {"status": "failed", "error": str(exc)}
```

---

### 2. Authentication Handling

**LinkedIn / Indeed:**
- **Best Practice:** Use Tayari's existing Chrome Extension to capture the user's authenticated session cookies.
- **Cookie Sync:** Extension extracts cookies (`li_at`, `JSESSIONID`) and sends them securely to the backend.
- **Session Storage:** Backend stores encrypted cookies in PostgreSQL (or Redis) with TTL matching cookie expiry.
- **Refresh:** Extension periodically refreshes and re-syncs cookies. If cookies expire, the user is prompted to re-login via the extension.

```python
# Cookie management module
from cryptography.fernet import Fernet
import json

class SessionManager:
    def __init__(self, encryption_key: bytes):
        self.cipher = Fernet(encryption_key)

    def store_session(self, user_id: str, platform: str, cookies: dict):
        encrypted = self.cipher.encrypt(json.dumps(cookies).encode())
        # Store in DB with platform, user_id, created_at, expires_at
        db.execute(
            """
            INSERT INTO user_sessions (user_id, platform, cookies, expires_at)
            VALUES (%s, %s, %s, NOW() + INTERVAL '7 days')
            ON CONFLICT (user_id, platform) DO UPDATE
            SET cookies = EXCLUDED.cookies, updated_at = NOW()
            """,
            (user_id, platform, encrypted)
        )

    def load_session(self, user_id: str, platform: str) -> dict:
        row = db.fetchone(
            """
            SELECT cookies FROM user_sessions
            WHERE user_id = %s AND platform = %s AND expires_at > NOW()
            """,
            (user_id, platform)
        )
        if row:
            return json.loads(self.cipher.decrypt(row["cookies"]).decode())
        return None
```

**Greenhouse / Lever / Ashby:**
- These platforms typically don't require authentication for public job postings.
- The agent navigates directly to the job URL and fills the form.

**Workday:**
- Some Workday portals require account creation before applying.
- **Strategy:** If the job is worth the effort, the agent can guide the user through account creation (human-in-the-loop), save the credentials, and reuse them for future applications to the same company.
- **2FA:** Skyvern supports TOTP-based 2FA. For Browser-Use, human-in-the-loop is required.

---

### 3. CAPTCHA Handling

| CAPTCHA Type | Detection | Handling Strategy | Integration |
|---|---|---|---|
| **reCAPTCHA v2** ("I'm not a robot") | Screenshot analysis + DOM detection | Human-in-the-loop pause | Frontend notification via WebSocket |
| **reCAPTCHA v3** (invisible scoring) | Behavioral analysis by platform | Rate limiting + human-like delays + residential proxies | Proxy rotation in Browser-Use |
| **hCaptcha** | DOM element detection | External solving service (2Captcha, Anti-Captcha) | API integration |
| **Image-based** (rare) | Screenshot + vision LLM | Human-in-the-loop or vision-LLM solving | Claude/GPT-4 vision |

**Recommended Approach:**
1. **Skyvern Cloud** has built-in CAPTCHA solving — use for cloud-hosted agents.
2. **For self-hosted:** Integrate a CAPTCHA-solving service as a fallback, but **always prefer human-in-the-loop** for job applications because:
   - It's a low-frequency action (not thousands per hour)
   - User trust is paramount
   - Platform terms of service are stricter on fully automated CAPTCHA solving

```python
# CAPTCHA detection and handling
async def handle_captcha(page):
    captcha_selectors = [
        ".g-recaptcha",
        "[data-sitekey]",
        ".h-captcha",
        "#captcha",
        'iframe[src*="recaptcha"]'
    ]

    for selector in captcha_selectors:
        element = await page.query_selector(selector)
        if element:
            # Pause task, notify user
            await pause_for_human_intervention(
                reason="captcha_detected",
                page_url=page.url,
                screenshot=await page.screenshot()
            )
            return True
    return False
```

---

### 4. Form Complexity Handling

**Job Application Form Field Types:**

| Field Type | Agent Handling | Difficulty |
|---|---|---|
| Text input (name, email) | Direct LLM mapping | Easy |
| Textarea (cover letter) | Generate tailored text, paste | Easy |
| Select dropdown | LLM selects option by text match | Medium |
| Date picker | Interact with calendar widget | Medium-Hard |
| File upload (resume, CV) | Use Playwright `set_input_files()` | Medium |
| Radio buttons | LLM selects by label text | Easy |
| Checkboxes | LLM selects by label text | Easy |
| Multi-page wizard | Track state across steps | Medium |
| Knockout questions ("Are you authorized to work?") | LLM answers based on user profile | Hard |
| Free-text screening questions | LLM generates contextual answers | Hard |
| EEO / Demographic questions | Skip or answer based on user preference | Medium |

**Workday-Specific Challenges:**
- Workday is the hardest platform. Simplify.jobs achieves only ~50% accuracy on Workday forms.
- Workday uses dynamic form generation, anti-bot detection, and strict field validation.
- **Strategy:** Pre-built workflow templates per Workday version, combined with human-in-the-loop for complex steps.

**Dropdown Handling:**

```python
# LLM-guided dropdown selection
async def handle_dropdown(page, field_label: str, desired_value: str):
    # Find the select element associated with the label
    select = await page.query_selector(f'text={field_label} >> xpath=../select')
    if not select:
        select = await page.query_selector(f'label:has-text("{field_label}") + select')

    # Get all options
    options = await select.query_selector_all("option")
    option_texts = [await opt.inner_text() for opt in options]

    # Ask LLM to pick the best match
    best_match = llm_select_best_option(desired_value, option_texts)
    await select.select_option(label=best_match)
```

**File Upload:**

```python
async def upload_resume(page, file_path: str):
    # Wait for file input
    input_file = await page.wait_for_selector('input[type="file"]')
    await input_file.set_input_files(file_path)

    # Verify upload succeeded (check for filename in DOM)
    uploaded = await page.query_selector(f'text={os.path.basename(file_path)}')
    assert uploaded is not None, "File upload failed"
```

---

### 5. Error Recovery & Robustness

**Error Categories and Recovery:**

| Error | Detection | Recovery Strategy |
|---|---|---|
| **Page layout change** | Expected element not found after timeout | LLM re-analyzes page; fallback to semantic search by label/text |
| **Network timeout** | Playwright timeout exception | Retry with exponential backoff; switch proxy if configured |
| **Form validation error** | Error message visible in DOM | LLM reads error, corrects field, retries |
| **Session expired** | Redirect to login page | Notify user to re-authenticate via extension |
| **Rate limited** | HTTP 429, Cloudflare challenge | Pause queue for this platform; switch proxy; notify user |
| **Job no longer available** | "This position has been filled" | Mark as closed in DB; skip |
| **Unexpected modal/dialog** | Modal dialog blocks interaction | LLM detects and dismisses or handles appropriately |

**Semantic Resilience Pattern:**
Instead of brittle CSS selectors, use LLM + accessibility tree:

```python
# Browser-Use's built-in approach (simplified)
async def resilient_click(page, target_description: str):
    # 1. Get accessibility snapshot (semantic tree)
    snapshot = await page.accessibility.snapshot()

    # 2. Feed to LLM: "Which element should I click to [target_description]?"
    element_id = llm.find_element(snapshot, target_description)

    # 3. Click by accessibility ID (not CSS selector)
    await page.click(f'[data-testid="{element_id}"]')
```

---

### 6. Rate Limiting & Anti-Bot Detection

**Platform-Specific Risk Levels:**

| Platform | Bot Detection Level | Safe Rate | Mitigation |
|---|---|---|---|
| **LinkedIn** | HIGH | 5–10 applications/day | Extension-based (user's own session); human-like delays; random intervals |
| **Indeed** | MEDIUM | 15–20 applications/day | Residential proxies; randomized User-Agent; human-like pacing |
| **Workday** | MEDIUM-HIGH | 3–5 per company/day | Company-specific pacing; proxy rotation; headless stealth |
| **Greenhouse** | LOW | 20–30/day | Minimal detection; standard Playwright ok |
| **Lever** | LOW | 20–30/day | Minimal detection; standard Playwright ok |
| **Ashby** | LOW | 20–30/day | Minimal detection; standard Playwright ok |
| **Custom portals** | Varies | Assess per site | Stealth plugins; proxy rotation; human-in-the-loop |

**Human-Like Behavior Checklist:**
- Random delays between actions (2–8 seconds, not fixed intervals)
- Mouse movement simulation (not just instant clicks)
- Scroll before interacting with elements below fold
- Read job description (scroll through page) before clicking Apply
- Session duration mimics real human attention span
- Time-of-day distribution (avoid 3 AM blasts)

**Proxy Strategy:**
- Use **residential proxies** for LinkedIn/Indeed (Bright Data, Oxylabs, Smartproxy)
- Rotate proxies per platform, not per request (keep session sticky)
- Geographic matching: proxy location should match user's typical location

```python
# Proxy configuration for Browser-Use
BrowserProfile(
    headless=True,
    proxy={
        "server": "http://residential.proxy.provider:8080",
        "username": "user",
        "password": "pass"
    },
    extra_headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
        "Accept-Language": "en-US,en;q=0.9"
    }
)
```

---

## Safety & Ethics Guardrails

### 1. Review-Before-Submit Architecture (Mandatory)

This is the **non-negotiable** safety checkpoint. The agent must NEVER auto-submit.

**Flow:**

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│  User    │───>│  Agent Runs  │───>│  Review Queue│───>│  User Reviews│───>│  Submit  │
│ Triggers │    │  (fills form)│    │  (snapshot)  │    │  & Approves  │    │  Agent   │
│  Apply   │    │              │    │              │    │              │    │  Clicks  │
│          │    │  Stops at    │    │  Screenshots │    │  Edits if    │    │  Submit  │
│          │    │  review page │    │  Field values│    │  needed      │    │          │
└──────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘
```

**Database Schema (Review Queue):**

```sql
CREATE TABLE application_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    job_url TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL, -- greenhouse, lever, workday, linkedin, etc.

    -- Agent execution state
    agent_run_id UUID REFERENCES agent_runs(id),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_review', -- pending_review, approved, rejected, submitted, expired

    -- Preview data (what the user sees for review)
    preview_data JSONB NOT NULL, -- structured field values, uploaded files, generated answers
    screenshot_urls TEXT[], -- array of S3 URLs for screenshots at each step

    -- User decision
    user_decision VARCHAR(20), -- approve, reject, edit
    user_edits JSONB, -- any overrides the user made
    reviewed_at TIMESTAMP,

    -- Submission tracking
    submitted_at TIMESTAMP,
    submission_confirmation TEXT, -- confirmation message, application ID, etc.

    -- Safety
    expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_queue_user_status ON application_review_queue(user_id, status);
CREATE INDEX idx_review_queue_expires ON application_review_queue(expires_at) WHERE status = 'pending_review';
```

**Frontend Review Component:**

```typescript
// React component for review UI
interface ApplicationReviewCard {
  reviewId: string;
  jobTitle: string;
  companyName: string;
  platform: string;
  fields: {
    label: string;
    agentValue: string;
    userOverride?: string;
    editable: boolean;
  }[];
  screenshots: string[];
  resumeUrl: string;
  coverLetter: string;
}

function ReviewQueue({ userId }: { userId: string }) {
  const [reviews, setReviews] = useState<ApplicationReviewCard[]>([]);

  // WebSocket connection for real-time updates
  useWebSocket(`/ws/reviews/${userId}`, (message) => {
    if (message.type === 'new_review') {
      setReviews(prev => [message.payload, ...prev]);
    }
  });

  return (
    <div className="review-queue">
      {reviews.map(review => (
        <ReviewCard
          key={review.reviewId}
          review={review}
          onApprove={() => submitReview(review.reviewId, 'approve')}
          onReject={() => submitReview(review.reviewId, 'reject')}
          onEdit={(edits) => submitReview(review.reviewId, 'edit', edits)}
        />
      ))}
    </div>
  );
}
```

---

### 2. Resume/Cover Letter Customization Per Job

**Tailoring Pipeline:**

```python
class ResumeTailoringEngine:
    def tailor_resume(self, base_resume: Resume, job_description: dict) -> TailoredResume:
        """
        1. Analyze job description for keywords, skills, requirements
        2. Match against user's base resume
        3. Reorder/emphasize relevant experience
        4. Generate variant resume + cover letter
        5. Save as new file with versioning
        """

        # Step 1: Extract job requirements using LLM
        requirements = self.llm.extract_requirements(job_description["text"])

        # Step 2: Score user's experience against requirements
        match_scores = self.score_experience(base_resume.experiences, requirements)

        # Step 3: Generate tailored content
        tailored = self.llm.generate_tailored_resume(
            base_resume=base_resume,
            job_requirements=requirements,
            match_scores=match_scores,
            tone="professional"  # or "casual" based on company culture
        )

        # Step 4: Save versioned copy
        version_id = self.save_resume_variant(
            user_id=base_resume.user_id,
            base_resume_id=base_resume.id,
            job_id=job_description["job_id"],
            tailored_content=tailored,
            generation_params={"model": self.llm.model_name, "timestamp": datetime.now()}
        )

        return TailoredResume(
            id=version_id,
            file_path=tailored.file_path,
            cover_letter=tailored.cover_letter,
            match_score=tailored.overall_score
        )
```

**User Controls:**
- User can set "tailoring intensity" (light/medium/aggressive)
- User can define "must-include" experiences
- User can review and edit the generated cover letter before it goes to the agent
- All tailored versions are saved for audit trail

---

### 3. Duplicate Detection

```sql
-- Track all applications to prevent duplicates
CREATE TABLE application_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    job_url TEXT NOT NULL,
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,

    -- Deduplication keys
    platform VARCHAR(50) NOT NULL,
    platform_job_id TEXT, -- Greenhouse job ID, Lever posting ID, etc.

    -- Application state
    status VARCHAR(30) NOT NULL, -- initiated, review_pending, submitted, rejected, duplicate_skipped

    -- If duplicate
    duplicate_of UUID REFERENCES application_attempts(id),
    duplicate_reason TEXT, -- same_url, same_platform_job_id, same_company_title_within_30_days

    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, platform_job_id) -- prevent exact duplicates
);

-- Duplicate detection logic
CREATE OR REPLACE FUNCTION check_duplicate_application()
RETURNS TRIGGER AS $$
BEGIN
    -- Check 1: Exact platform job ID duplicate
    IF EXISTS (
        SELECT 1 FROM application_attempts
        WHERE user_id = NEW.user_id
        AND platform_job_id = NEW.platform_job_id
        AND status IN ('submitted', 'review_pending')
    ) THEN
        NEW.status := 'duplicate_skipped';
        NEW.duplicate_reason := 'Already applied to this job posting';
        RETURN NEW;
    END IF;

    -- Check 2: Same company + similar title within 30 days
    IF EXISTS (
        SELECT 1 FROM application_attempts
        WHERE user_id = NEW.user_id
        AND company_name = NEW.company_name
        AND similarity(job_title, NEW.job_title) > 0.7
        AND created_at > NOW() - INTERVAL '30 days'
        AND status IN ('submitted', 'review_pending')
    ) THEN
        NEW.status := 'duplicate_skipped';
        NEW.duplicate_reason := 'Applied to similar role at this company recently';
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### 4. Application Quality Control

**Quality Checks Before Review Queue:**

1. **Required Fields Validation:** All fields marked as required by the agent must have non-empty values.
2. **Email Format Validation:** Validate email format matches user's verified email.
3. **Phone Format Validation:** Normalize and validate phone numbers.
4. **File Upload Verification:** Confirm resume file was actually uploaded (not just selected).
5. **Cover Letter Quality Score:** LLM-generated cover letter must score above threshold (0.7/1.0) on relevance, grammar, and personalization.
6. **Knockout Question Check:** Flag any "knockout" questions (e.g., "Do you require sponsorship?") for user attention.

```python
class QualityGate:
    def run_checks(self, agent_result: AgentResult) -> QualityReport:
        checks = []

        # Check 1: All required fields filled
        required_empty = [f for f in agent_result.fields if f.required and not f.value]
        checks.append(QualityCheck(
            name="required_fields",
            passed=len(required_empty) == 0,
            details=f"Missing: {[f.label for f in required_empty]}"
        ))

        # Check 2: Cover letter quality
        if agent_result.cover_letter:
            score = self.llm.score_quality(agent_result.cover_letter)
            checks.append(QualityCheck(
                name="cover_letter_quality",
                passed=score > 0.7,
                details=f"Score: {score}"
            ))

        # Check 3: Knockout questions
        knockouts = [f for f in agent_result.fields if f.is_knockout]
        checks.append(QualityCheck(
            name="knockout_questions",
            passed=True,  # Always pass but flag
            flag_for_user=True,
            details=f"Knockout questions answered: {[f.label for f in knockouts]}"
        ))

        overall_pass = all(c.passed for c in checks if not c.flag_for_user)
        return QualityReport(checks=checks, overall_pass=overall_pass)
```

---

### 5. Platform Terms of Service Compliance

| Platform | Automation Policy | Enforcement | Tayari Strategy |
|---|---|---|---|
| **LinkedIn** | Prohibits automated tools and bots (User Agreement) | Medium — rate limiting, account flags | **Chrome Extension only** (user's own browser, human-like pacing). Never cloud-agent LinkedIn. |
| **Indeed** | Prohibits automated or bulk applications | Low-Medium | Extension + careful pacing. Max 15-20/day. |
| **Glassdoor** | Prohibits automated data collection | Low | Avoid automation; use for job discovery only. |
| **Workday** | No explicit bot policy (varies by employer) | Very Low | Cloud agent acceptable. Employer-specific. |
| **Greenhouse** | No explicit bot policy | Very Low | Cloud agent acceptable. Most permissive. |
| **Lever** | No explicit bot policy | Very Low | Cloud agent acceptable. |
| **Ashby** | No explicit bot policy | Very Low | Cloud agent acceptable. |
| **Custom ATS** | Varies | Varies | Assess per site. Use extension for sensitive portals. |

**Key Compliance Principles:**
1. **Never auto-submit** — always human review.
2. **Never bypass CAPTCHAs** with automated solvers on major platforms (use human-in-the-loop).
3. **Never scrape personal data** from other users' profiles.
4. **Respect robots.txt** and rate limits.
5. **Transparent disclosure** — Tayari should inform users that automation may violate platform terms and that users assume responsibility.
6. **Consent required** — Explicit opt-in for each platform before automation begins.

---

## Proposed Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TAYARI PLATFORM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────┐      ┌─────────────────────────────────────┐    │
│  │   REACT 18 FRONTEND     │      │       GO BACKEND (chi)              │    │
│  │   (Port 3000)           │      │       (Port 8080)                   │    │
│  │                         │      │                                     │    │
│  │  ┌───────────────────┐  │      │  ┌─────────────┐  ┌──────────────┐ │    │
│  │  │ Review Queue UI   │  │<─────│  │ User API    │  │ Job Board API│ │    │
│  │  │ Agent Status      │  │      │  │ Auth        │  │ Analytics    │ │    │
│  │  │ Approval Flow     │  │      │  └─────────────┘  └──────────────┘ │    │
│  │  └───────────────────┘  │      │                                     │    │
│  │                         │      │  ┌────────────────────────────────┐ │    │
│  │  ┌───────────────────┐  │      │  │ Application Orchestration API  │ │    │
│  │  │ Chrome Extension  │  │      │  │  - Queue jobs for application  │ │    │
│  │  │ (Manifest V3)     │  │      │  │  - Track application status      │ │    │
│  │  │ - Job detection   │  │      │  │  - Duplicate detection         │ │    │
│  │  │ - Cookie sync     │  │      │  │  - User consent management     │ │    │
│  │  │ - Autofill helper │  │      │  └────────────────────────────────┘ │    │
│  │  └───────────────────┘  │      └─────────────────────────────────────┘    │
│  └─────────────────────────┘                                                 │
│                              │                                                 │
│                              │ REST / WebSocket                                │
│                              ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    PYTHON FASTAPI BACKEND (Port 8000)                     │  │
│  │                                                                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────┐  │  │
│  │  │ Resume AI   │  │ Job Scrape  │  │     Application Agent Service   │  │  │
│  │  │ (Existing)  │  │ (Crawl4AI)  │  │                                 │  │  │
│  │  │             │  │             │  │  ┌──────────┐  ┌────────────┐  │  │  │
│  │  │ - Tailoring │  │ - Markdown  │  │  │ Agent    │  │ Quality    │  │  │  │
│  │  │ - Cover     │  │ - Extract   │  │  │ Runner   │  │ Gate       │  │  │  │
│  │  │   Letter    │  │ - BM25      │  │  │ (Celery) │  │            │  │  │  │
│  │  └─────────────┘  └─────────────┘  │  └──────────┘  └────────────┘  │  │  │
│  │                                    │  ┌──────────┐  ┌────────────┐  │  │  │
│  │                                    │  │ Review   │  │ Submission │  │  │  │
│  │                                    │  │ Queue    │  │ Executor   │  │  │  │
│  │                                    │  │ Manager  │  │            │  │  │  │
│  │                                    │  └──────────┘  └────────────┘  │  │  │
│  │                                    │  ┌──────────┐  ┌────────────┐  │  │  │
│  │                                    │  │ Platform │  │ Session    │  │  │  │
│  │                                    │  │ Adapters │  │ Manager    │  │  │  │
│  │                                    │  │          │  │ (Cookies)  │  │  │  │
│  │                                    │  └──────────┘  └────────────┘  │  │  │
│  │                                    └─────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │              BROWSER AUTOMATION LAYER                           │   │  │
│  │  │                                                                 │   │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │   │  │
│  │  │  │ Browser-Use  │  │ Skyvern      │  │ Playwright Pool    │  │   │  │
│  │  │  │ (Primary)    │  │ (Fallback)   │  │ (Low-level)        │  │   │  │
│  │  │  │              │  │              │  │                    │  │   │  │
│  │  │  │ - LinkedIn   │  │ - Workday    │  │ - Custom portals   │  │   │  │
│  │  │  │ - Greenhouse │  │ - Complex    │  │ - Edge cases       │  │   │  │
│  │  │  │ - Lever      │  │   forms      │  │                    │  │   │  │
│  │  │  │ - Ashby      │  │ - CAPTCHA    │  │                    │  │   │  │
│  │  │  └──────────────┘  └──────────────┘  └────────────────────┘  │   │  │
│  │  │                                                                 │   │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │   │  │
│  │  │  │ Proxy Rotator│  │ Stealth      │  │ CAPTCHA Handler    │  │   │  │
│  │  │  │ (Bright Data)│  │ Plugin       │  │ (Human-in-loop)    │  │   │  │
│  │  │  └──────────────┘  └──────────────┘  └────────────────────┘  │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                         │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │  │
│  │  │  LLM Provider Router    │  │  Task Queue (Celery + Redis)          │  │  │
│  │  │                         │  │                                     │  │  │
│  │  │  - Ollama (local)       │  │  - Async job processing               │  │  │
│  │  │  - OpenAI (fallback)    │  │  - Retry with backoff                 │  │  │
│  │  │  - Anthropic (Claude)   │  │  - Rate limiting per platform         │  │  │
│  │  │  - LiteLLM (unified)    │  │  - Priority queue                     │  │  │
│  │  └─────────────────────────┘  └─────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                         POSTGRESQL DATABASE                            │  │
│  │                                                                         │  │
│  │  users │ jobs │ resumes │ application_attempts │ review_queue         │  │
│  │  │ agent_runs │ user_sessions │ tailored_resumes │ platform_configs     │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Schema Additions

```sql
-- Core agent execution tracking
CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    task_type VARCHAR(50) NOT NULL, -- 'job_application', 'job_scrape', 'profile_sync'
    status VARCHAR(30) NOT NULL DEFAULT 'running', -- running, completed, failed, paused_for_review

    -- Task configuration
    target_url TEXT,
    platform VARCHAR(50),
    configuration JSONB, -- agent-specific settings, LLM model used, etc.

    -- Execution metrics
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    steps_taken INTEGER DEFAULT 0,
    llm_calls INTEGER DEFAULT 0,
    tokens_consumed INTEGER DEFAULT 0,
    estimated_cost_usd DECIMAL(10,4),

    -- Error tracking
    error_message TEXT,
    error_screenshot_url TEXT,

    -- Result
    result_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Application attempts (with duplicate detection)
CREATE TABLE application_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    agent_run_id UUID REFERENCES agent_runs(id),

    -- Target
    job_url TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL,
    platform_job_id TEXT,
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,

    -- Status lifecycle
    status VARCHAR(30) NOT NULL DEFAULT 'initiated',
    -- initiated -> agent_running -> review_pending -> approved -> submitted -> confirmed
    --                                           -> rejected
    --                                           -> expired
    --                              -> failed

    -- Review checkpoint
    review_queue_id UUID,
    reviewed_at TIMESTAMP,
    user_decision VARCHAR(20),

    -- Submission
    submitted_at TIMESTAMP,
    confirmation_id TEXT, -- platform's confirmation/application ID
    confirmation_screenshot_url TEXT,

    -- Duplicate tracking
    duplicate_of UUID REFERENCES application_attempts(id),

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, platform_job_id)
);

-- Review queue (detailed above in Safety section)
-- ... (see previous section)

-- User platform sessions (encrypted cookies)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    platform VARCHAR(50) NOT NULL,
    cookies BYTEA NOT NULL, -- encrypted
    headers JSONB, -- additional headers like User-Agent
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

-- Tailored resume versions
CREATE TABLE tailored_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    base_resume_id UUID NOT NULL REFERENCES resumes(id),
    job_id UUID REFERENCES jobs(id),

    file_path TEXT NOT NULL,
    file_size INTEGER,
    cover_letter TEXT,

    -- Generation metadata
    match_score DECIMAL(3,2), -- 0.00 to 1.00
    generation_model VARCHAR(50),
    generation_params JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Platform-specific configuration templates
CREATE TABLE platform_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL UNIQUE,

    -- Agent behavior settings
    agent_type VARCHAR(50), -- 'browser_use', 'skyvern', 'playwright'
    default_prompt_template TEXT,
    max_steps INTEGER DEFAULT 50,
    headless BOOLEAN DEFAULT true,

    -- Rate limiting
    max_applications_per_day INTEGER DEFAULT 20,
    min_delay_seconds INTEGER DEFAULT 3,
    max_delay_seconds INTEGER DEFAULT 8,

    -- Proxy settings
    proxy_required BOOLEAN DEFAULT false,
    proxy_rotation_strategy VARCHAR(50),

    -- Safety
    requires_review BOOLEAN DEFAULT true,
    allows_auto_submit BOOLEAN DEFAULT false,

    -- Selectors / platform-specific hints (fallback for known structures)
    known_selectors JSONB,

    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Queue System: Celery + Redis + Flower

**Why Celery over Bull/BullMQ?**
- Tayari's Python FastAPI backend is already Python-native. Celery integrates seamlessly.
- Redis is already likely in use for caching/sessions.
- Flower provides a web UI for monitoring queues, retry rates, and task execution.

```python
# celeryconfig.py
broker_url = "redis://localhost:6379/0"
result_backend = "redis://localhost:6379/0"

task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]

timezone = "UTC"
enable_utc = True

# Rate limiting per platform
task_annotations = {
    "tasks.run_application_agent": {
        "rate_limit": "10/m",  # Global rate for safety
    }
}

# Queue routing
task_routes = {
    "tasks.run_application_agent": {"queue": "applications"},
    "tasks.scrape_job_description": {"queue": "scraping"},
    "tasks.sync_user_session": {"queue": "sessions"},
}

# Retry configuration
task_default_retry_delay = 60
task_max_retries = 3
task_default_queue = "default"
```

**Platform-Specific Rate Limiting:**

```python
# rate_limiter.py
from redis import Redis
import time

class PlatformRateLimiter:
    def __init__(self, redis: Redis):
        self.redis = redis

    def can_proceed(self, user_id: str, platform: str) -> bool:
        """
        Check if user can apply to another job on this platform now.
        Uses Redis for distributed rate limiting.
        """
        key = f"rate_limit:{user_id}:{platform}"
        config = get_platform_config(platform)

        # Sliding window: count applications in last 24 hours
        window_start = time.time() - 86400
        pipeline = self.redis.pipeline()
        pipeline.zremrangebyscore(key, 0, window_start)
        pipeline.zcard(key)
        _, count = pipeline.execute()

        if count >= config.max_applications_per_day:
            return False

        # Minimum delay since last application
        last = self.redis.zrevrange(key, 0, 0, withscores=True)
        if last:
            elapsed = time.time() - last[0][1]
            if elapsed < config.min_delay_seconds:
                return False

        return True

    def record_attempt(self, user_id: str, platform: str):
        key = f"rate_limit:{user_id}:{platform}"
        self.redis.zadd(key, {str(time.time()): time.time()})
        self.redis.expire(key, 86400)
```

---

## Implementation Roadmap

### Phase 1: MVP (Chrome Extension + Human-in-the-Loop) — 6-8 weeks

**Goal:** Prove the concept with LinkedIn Easy Apply and Greenhouse using the existing Chrome Extension.

**Deliverables:**
1. **Extension Enhancement:**
   - Detect job application forms on LinkedIn, Greenhouse, Lever
   - Extract form fields and send to FastAPI backend
   - Display "Tayari Autofill" button on application pages
   - Capture authenticated session cookies (with user consent)

2. **Backend MVP:**
   - Integrate Crawl4AI for job description scraping
   - Resume/cover letter tailoring pipeline (existing API)
   - Simple agent using Playwright (direct, not Browser-Use yet) to fill forms
   - Review queue API (POST/GET application previews)

3. **Frontend Review UI:**
   - Review queue page showing filled forms, screenshots, file uploads
   - Approve/Reject/Edit actions
   - Submit-on-approval triggers extension to click final submit

4. **Database:**
   - Add `application_attempts`, `review_queue`, `user_sessions` tables

**Success Criteria:**
- User can apply to 10 LinkedIn Easy Apply jobs with review-before-submit
- Greenhouse forms autofill with >90% accuracy
- Zero auto-submissions (100% human review)

---

### Phase 2: Cloud Agent for ATS Portals — 8-10 weeks

**Goal:** Add cloud-hosted agents for Workday, custom portals, and batch applications.

**Deliverables:**
1. **Browser-Use Integration:**
   - Install and configure Browser-Use in Python backend
   - Platform-specific prompt templates (Greenhouse, Lever, Workday, Ashby)
   - DOM-distillation mode for lower token costs
   - Ollama integration for local LLM inference

2. **Skyvern Fallback:**
   - Install Skyvern for complex Workday forms and CAPTCHA handling
   - Cloud instance or self-hosted container
   - Workflow builder for non-engineers to define application paths

3. **Queue System:**
   - Celery + Redis setup
   - Flower monitoring dashboard
   - Platform-specific rate limiting
   - Retry logic with exponential backoff

4. **Proxy & Stealth Infrastructure:**
   - Residential proxy integration (Bright Data or Oxylabs)
   - Browser fingerprint randomization
   - Stealth plugin for Playwright

5. **Batch Application Mode:**
   - User selects multiple jobs, queues them all
   - Agent processes overnight, fills review queue
   - User wakes up to 20 applications ready for review

**Success Criteria:**
- 5+ platforms supported (LinkedIn, Indeed, Greenhouse, Lever, Workday)
- Batch mode: 50 jobs queued, 80% reach review queue successfully
- Workday accuracy >70% (industry-leading for automation)
- Average cost per application < $0.50 (LLM tokens + proxy)

---

### Phase 3: Advanced Intelligence & Scale — 10-12 weeks

**Goal:** Make the agent truly intelligent, self-healing, and scalable.

**Deliverables:**
1. **Multi-Agent Orchestration:**
   - Planner agent: decides which platform agent to use
   - Scraper agent: Crawl4AI for job descriptions
   - Tailor agent: resume/cover letter customization
   - Form agent: Browser-Use/Skyvern for filling
   - Review agent: quality gate before human review
   - Submit agent: final submission after approval

2. **Self-Healing Selectors:**
   - When a form layout changes, the agent records the failure
   - LLM re-analyzes page and generates new selector strategy
   - Store successful selector patterns per platform version
   - Feedback loop improves accuracy over time

3. **Application Analytics:**
   - Track which applications led to interviews
   - A/B test resume variants
   - Recommend jobs with highest predicted success rate
   - User dashboard: "Your application-to-interview rate is X%"

4. **Enterprise Features:**
   - Team accounts (recruiters applying on behalf of candidates)
   - API for third-party integrations
   - Webhook notifications (Slack, Teams)
   - SSO / SAML

**Success Criteria:**
- 10+ platforms supported
- Agent self-heals on 50% of layout changes without human intervention
- Application-to-interview tracking accuracy >80%
- Enterprise pilot with 3+ paying customers

---

## Competitive Gaps Tayari Can Exploit

### 1. Mandatory Review-Before-Submit

**Current State:**
- FastApply: Claims review but users report accidental auto-submits
- LoopCV: No review queue; auto-submits after user sets filters
- LazyApply: Bulk submits without per-application review
- Simplify.jobs: Limited review, no screenshot proof
- rtrvr.ai: Has review feature but UX is cluttered and unreliable

**Tayari Advantage:**
- First-class review UI with full screenshots, field-by-field preview, edit capability
- Screenshot proof of every step (like scale.jobs but automated)
- No submission possible without explicit user approval
- Builds trust; users never worry about accidental or bad submissions

---

### 2. Platform Coverage & Workday Handling

**Current State:**
- Simplify.jobs: ~50% accuracy on Workday, no Taleo support
- LazyApply: Limited to LinkedIn, Indeed, ZipRecruiter
- LoopCV: Extension-based, struggles with complex ATS
- rtrvr.ai: Claims Workday support but user reports are mixed

**Tayari Advantage:**
- Dedicated Skyvern integration for Workday (best-in-class form filling)
- Platform-specific prompt templates that evolve with UI changes
- Fallback to human-in-the-loop for Workday when automation fails
- Transparent accuracy metrics per platform ("Workday: 72% success rate")

---

### 3. Local LLM + Privacy-First Architecture

**Current State:**
- All competitors require cloud LLM APIs (OpenAI, etc.)
- User data (resume, personal info) sent to third-party servers
- No local/self-hosted option

**Tayari Advantage:**
- Ollama integration for local LLM inference (privacy-conscious users)
- User controls where data goes: local, self-hosted, or cloud
- Encrypted cookie storage; no credential sharing with Tayari staff
- Open-source friendly (future possibility)

---

### 4. Intelligent Job Matching BEFORE Application

**Current State:**
- Competitors apply first, ask questions later
- High volume of irrelevant applications
- Users report getting flagged for spam by employers

**Tayari Advantage:**
- Crawl4AI + LLM scoring: match job description to user profile BEFORE queuing
- Only queue applications with match score > 0.6
- User sees: "This job matches you 85% — worth applying?"
- Reduces volume, increases quality, protects user reputation

---

### 5. Transparent Pricing & No "Volume Over Quality"

**Current State:**
- LoopCV: Lifetime deals create unsustainable support burden
- LazyApply: $999/year for unlimited bulk applications (encourages spam)
- Simplify.jobs: $39/month for unlimited (quality not guaranteed)
- FastApply: $14/mo starter but pushes higher tiers for AI tailoring

**Tayari Advantage:**
- Pay-per-application-reviewed model (aligns incentives: we only get paid for successful completions)
- Free tier: 5 applications/month with manual review
- Pro tier: $19/month for 20 applications + priority queue
- Enterprise: Custom for teams
- No unlimited bulk plans — reinforces quality-over-quantity philosophy

---

### 6. Resume Variant A/B Testing

**Current State:**
- LoopCV has A/B testing but users report it's basic
- No competitor tracks which resume variant led to which interview

**Tayari Advantage:**
- Automatic A/B testing: apply with variant A to half, variant B to half
- Track interview correlation by variant
- Recommend "Version 2 of your resume gets 40% more callbacks"
- Data-driven resume optimization

---

## Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **LinkedIn account ban** | Medium | High | Extension-only for LinkedIn; human-like pacing; max 5-10/day; user education |
| **Workday form failure** | High | Medium | Skyvern fallback; human-in-the-loop for complex steps; transparent accuracy metrics |
| **LLM hallucination (wrong info in form)** | Medium | High | Quality gate; required field validation; human review checkpoint; screenshot proof |
| **CAPTCHA blocking agent** | Medium | Medium | Human-in-the-loop pause; Skyvern CAPTCHA solving; avoid automated CAPTCHA bypass services |
| **Platform layout change breaking selectors** | High | Medium | Semantic LLM-based selectors; self-healing feedback loop; cached selector patterns per version |
| **Privacy breach (cookie theft)** | Low | High | Encrypted storage; minimal permission extension; SOC 2 Type 2 roadmap; security audit |
| **Cost overrun (LLM tokens)** | Medium | Medium | DOM-distillation mode; local LLM option; token budget per job; cost monitoring dashboard |
| **User trust (fear of bad submissions)** | Medium | High | Review-before-submit as core feature; screenshot proof; zero auto-submit policy; money-back guarantee |
| **Legal / ToS violations** | Medium | High | Platform compliance matrix; user consent; transparent disclosure; no LinkedIn cloud automation |
| **Competitor response (FastApply, rtrvr.ai)** | Medium | Medium | Speed to market; focus on Tayari's existing user base; leverage existing resume AI; open-source community |

---

## Recommended Next Steps

### Immediate (Week 1-2)

1. **Technical Spike:** Install Browser-Use and Skyvern in a local branch of the Python FastAPI backend. Run test agents against 5 Greenhouse and 2 Workday job URLs. Measure success rate, token cost, and execution time.

2. **Competitive Audit:** Sign up for free trials of Simplify.jobs, FastApply, and rtrvr.ai. Document their UX flows, accuracy on real job forms, and review mechanisms. Record screen captures for team reference.

3. **Legal Review:** Have counsel review LinkedIn User Agreement, Indeed Terms of Service, and general CFAA implications of browser automation. Draft user consent language.

4. **Chrome Extension Audit:** Review current extension's permission model. Ensure it only requests access to job board domains (not "all websites"). Plan cookie sync API endpoint.

### Short-Term (Week 3-6)

5. **MVP Scoping:** Define the exact Phase 1 scope. Which 2 platforms? Which job types? Set success metrics (accuracy >90%, review queue functional, zero auto-submits).

6. **Database Migration:** Write Alembic migrations for `application_attempts`, `review_queue`, `agent_runs`, `user_sessions`, `tailored_resumes`.

7. **Queue Setup:** Deploy Redis and Celery locally. Create the `run_application_agent` task skeleton. Test with mocked browser interactions.

8. **Review UI Mockups:** Design the review queue frontend. Key screens: queue list, detail view with screenshots, field editor, approve/reject buttons.

### Medium-Term (Week 7-14)

9. **Browser-Use Production Integration:** Replace mocked tasks with real Browser-Use agent calls. Implement platform-specific prompt templates. Add DOM-distillation for cost control.

10. **Skyvern Integration:** Add Skyvern as fallback for Workday and complex forms. Test CAPTCHA handling and 2FA flows.

11. **Proxy & Stealth Infrastructure:** Set up Bright Data or Oxylabs trial. Configure proxy rotation and stealth headers. Test against LinkedIn/Indeed with extension fallback.

12. **Rate Limiting & Safety:** Implement Redis-based rate limiter. Add quality gate checks. Enforce review-before-submit across all code paths.

### Long-Term (Month 4-6)

13. **Multi-Agent Orchestration:** Refactor from single agent to planner/scraper/tailor/form/review/submit agent swarm. Use Celery chains and chords for coordination.

14. **Self-Healing Selectors:** Implement feedback loop where failed runs trigger LLM re-analysis and selector regeneration. Store patterns in `platform_configs.known_selectors`.

15. **Analytics & A/B Testing:** Build application-to-interview tracking. Resume variant A/B testing. Predictive match scoring.

16. **Enterprise Pilot:** Identify 3-5 early adopters for team/enterprise tier. Gather feedback on recruiter workflows and API needs.

---

## Appendix A: Verified GitHub Repositories & Links

| Project | URL | Stars (as of research date) |
|---|---|---|
| Browser-Use | https://github.com/browser-use/browser-use | 97,000+ |
| Skyvern | https://github.com/Skyvern-AI/skyvern | ~20,000+ |
| Crawl4AI | https://github.com/unclecode/crawl4ai | 46,000-68,000+ |
| Firecrawl | https://github.com/mendableai/firecrawl | 130,000+ |
| Stagehand | https://github.com/browserbase/stagehand | 23,000+ |
| Agent Browser | https://github.com/vercel/agent-browser | 35,000+ |
| Playwright | https://github.com/microsoft/playwright | 70,000+ |
| Steel (awesome-web-agents) | https://github.com/steel-dev/awesome-web-agents | 7,100+ |

---

## Appendix B: Cost Estimates (Per Application)

| Component | Cost Range | Notes |
|---|---|---|
| **LLM Tokens (GPT-4o-mini)** | $0.05 - $0.15 | DOM-distillation mode; 50-150 steps per application |
| **LLM Tokens (Local Ollama)** | $0.00 | Requires GPU server; higher latency |
| **Proxy (Residential)** | $0.01 - $0.05 | Bright Data pay-as-you-go; shared proxies |
| **CAPTCHA Solving (if needed)** | $0.02 - $0.05 | 2Captcha/anti-captcha API |
| **Browser-Use/Skyvern** | $0.00 | Open source; self-hosted |
| **Total (cloud LLM)** | **$0.08 - $0.25** | Per application attempt (not per submit) |
| **Total (local LLM)** | **$0.01 - $0.05** | Proxy only; requires GPU infrastructure |

**Note:** Costs are for the agent run only. Resume tailoring (existing Tayari feature) is separate.

---

*Document generated by Tayari Research Sub-Agent | 2026-06-20 | Research sources: Browser-Use docs, Skyvern docs, Crawl4AI docs, rtrvr.ai website, competitive tool analyses (FastApply, LoopCV, LazyApply, Simplify.jobs, JobWizard, scale.jobs), web automation research papers (WebVoyager, TheAgentCompany, Workarena++), platform ToS documents, and industry reports on job application automation.*
