"""LLM provider abstraction layer — Tayari version.

Design: SOLID-principled provider hierarchy.
  - Interface (LLMProvider): Single Responsibility — one method, complete().
  - Concrete providers: OpenAI-compatible, Ollama, OpenRouter, NVIDIA NIM, Hermes, Mock.
  - Factory (build_provider): Open/Closed — add providers without touching routing logic.
  - llm_complete() and llm_json(): stable public API, never crash.

Provider selection (priority order):
  1. tier == 'hermes'     → HermesProvider  (if HERMES_AGENT_URL set)
  2. LLM_PROVIDER=openrouter → OpenRouterProvider (OPENROUTER_API_KEY required)
  3. LLM_PROVIDER=nvidia_nim → NVIDIANIMProvider  (NVIDIA_NIM_API_KEY required)
  4. LLM_PROVIDER=ollama  → OllamaProvider        (LLM_BASE_URL ending in /v1 or 11434)
  5. LLM_BASE_URL set     → OpenAICompatibleProvider (generic)
  6. fallback             → MockProvider           (never crashes)

Environment variables:
  LLM_PROVIDER        = openrouter | nvidia_nim | ollama | openai | (empty → auto-detect)
  LLM_BASE_URL        = base URL for the chosen provider
  LLM_API_KEY         = API key (also read as OPENROUTER_API_KEY, NVIDIA_NIM_API_KEY)
  LLM_MODEL           = model name
  OPENROUTER_API_KEY  = OpenRouter specific key
  OPENROUTER_MODEL    = default: openai/gpt-4o-mini
  NVIDIA_NIM_API_KEY  = NVIDIA NIM specific key
  NVIDIA_NIM_MODEL    = default: meta/llama-3.1-70b-instruct
  NVIDIA_NIM_BASE_URL = default: https://integrate.api.nvidia.com/v1
  HERMES_AGENT_URL    / HERMES_API_KEY / HERMES_MODEL (from hermes config module)
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from abc import ABC, abstractmethod
from typing import Optional

import httpx

from app.services.hermes import config as hermes_config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Interface (Liskov + Dependency Inversion)
# ---------------------------------------------------------------------------

class LLMProvider(ABC):
    """Abstract base — every concrete provider must implement complete()."""

    @abstractmethod
    async def complete(
        self,
        system_message: str,
        user_message: str,
        max_tokens: int = 800,
        temperature: float = 0.3,
    ) -> str: ...

    def active_engine_label(self) -> str:
        return self.__class__.__name__


# ---------------------------------------------------------------------------
# Concrete providers
# ---------------------------------------------------------------------------

class OpenAICompatibleProvider(LLMProvider):
    """Any OpenAI-compatible /chat/completions endpoint (vLLM, Together, Groq, etc.)."""

    def __init__(self, base_url: str, api_key: str, model: str) -> None:
        self._base = base_url.rstrip("/")
        self._key = api_key
        self._model = model

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        headers = {"Content-Type": "application/json"}
        if self._key:
            headers["Authorization"] = f"Bearer {self._key}"
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(f"{self._base}/chat/completions",
                                     json=payload, headers=headers)
            resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    def active_engine_label(self) -> str:
        return f"openai-compatible ({self._model})"


class OllamaProvider(LLMProvider):
    """Local Ollama server — uses /api/generate (not chat/completions)."""

    def __init__(self, base_url: str, model: str) -> None:
        self._base = base_url.rstrip("/")
        self._model = model

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        payload = {
            "model": self._model,
            "prompt": f"{system_message}\n\n{user_message}",
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(f"{self._base}/api/generate", json=payload)
            resp.raise_for_status()
        return resp.json().get("response", "")

    def active_engine_label(self) -> str:
        return f"ollama-{self._model}"


class OpenRouterProvider(LLMProvider):
    """OpenRouter (https://openrouter.ai) — OpenAI-compatible with extra headers."""

    BASE = "https://openrouter.ai/api/v1"
    DEFAULT_MODEL = "openrouter/free"
    MAX_RETRIES = 3

    def __init__(self, api_key: str, model: str) -> None:
        self._key = api_key
        self._model = model or self.DEFAULT_MODEL

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._key}",
            "HTTP-Referer": "https://tayari.app",
            "X-Title": "Tayari AI",
        }
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=180) as client:
                    resp = await client.post(f"{self.BASE}/chat/completions",
                                             json=payload, headers=headers)
                    if resp.status_code == 429:
                        remaining = resp.headers.get("X-RateLimit-Remaining", "0")
                        reset = resp.headers.get("X-RateLimit-Reset", "5")
                        wait = (2 ** attempt) + (int(reset) if reset.isdigit() else 5)
                        logger.warning("OpenRouter 429 (attempt %d/%d, remaining=%s); retrying in %ds",
                                       attempt + 1, self.MAX_RETRIES, remaining, wait)
                        import asyncio
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < self.MAX_RETRIES - 1:
                    continue
                logger.error("OpenRouter HTTP error after %d retries: %s", attempt + 1, e)
                raise
            except Exception as e:
                logger.error("OpenRouter request error (attempt %d/%d): %s", attempt + 1, self.MAX_RETRIES, e)
                if attempt == self.MAX_RETRIES - 1:
                    raise
        raise RuntimeError("OpenRouter exhausted retries")

    def active_engine_label(self) -> str:
        return f"openrouter/{self._model}"


class NVIDIANIMProvider(LLMProvider):
    """NVIDIA NIM inference API — OpenAI-compatible with NVIDIA endpoint."""

    DEFAULT_BASE = "https://integrate.api.nvidia.com/v1"
    DEFAULT_MODEL = "meta/llama-3.1-70b-instruct"

    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self._key = api_key
        self._model = model or self.DEFAULT_MODEL
        self._base = (base_url or self.DEFAULT_BASE).rstrip("/")

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._key}",
        }
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(f"{self._base}/chat/completions",
                                     json=payload, headers=headers)
            resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    def active_engine_label(self) -> str:
        return f"nvidia-nim/{self._model}"


class HermesProvider(LLMProvider):
    """Hermes agent endpoint — OpenAI-compatible, falls back to mock on error."""

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        base = hermes_config.HERMES_AGENT_URL.rstrip("/")
        headers = {"Content-Type": "application/json"}
        if hermes_config.HERMES_API_KEY:
            headers["Authorization"] = f"Bearer {hermes_config.HERMES_API_KEY}"
        payload = {
            "model": hermes_config.HERMES_MODEL,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                resp = await client.post(f"{base}/chat/completions",
                                         json=payload, headers=headers)
                resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:  # noqa: BLE001
            logger.warning("hermes completion failed (%s); falling back to mock", exc)
            return _mock_text()

    def active_engine_label(self) -> str:
        return f"hermes-{hermes_config.HERMES_MODEL}"


class MockProvider(LLMProvider):
    """Graceful no-op when no LLM is configured. Never crashes."""

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        logger.warning("No LLM configured — returning mock response.")
        return _mock_text(system_message, user_message)

    def active_engine_label(self) -> str:
        return "mock-fallback"


# ---------------------------------------------------------------------------
# Factory (Open/Closed — extend here, not inside callers)
# ---------------------------------------------------------------------------

def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def build_provider(tier: str = "default") -> LLMProvider:
    """Return the best available provider for the given tier."""
    # Hermes tier — always honoured when available
    if tier == "hermes" and hermes_config.HERMES_AGENT_URL:
        return HermesProvider()

    provider_name = _env("LLM_PROVIDER").lower()

    if provider_name == "openrouter":
        key = _env("OPENROUTER_API_KEY") or _env("LLM_API_KEY")
        model = _env("OPENROUTER_MODEL", "openai/gpt-4o-mini")
        if key:
            return OpenRouterProvider(key, model)
        logger.warning("LLM_PROVIDER=openrouter but OPENROUTER_API_KEY not set; falling back")

    if provider_name == "nvidia_nim":
        key = _env("NVIDIA_NIM_API_KEY") or _env("LLM_API_KEY")
        model = _env("NVIDIA_NIM_MODEL", "meta/llama-3.1-70b-instruct")
        base = _env("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
        if key:
            return NVIDIANIMProvider(key, model, base)
        logger.warning("LLM_PROVIDER=nvidia_nim but NVIDIA_NIM_API_KEY not set; falling back")

    if provider_name in ("ollama", "") and _env("LLM_BASE_URL"):
        base = _env("LLM_BASE_URL")
        if "ollama" in base.lower() or "11434" in base:
            return OllamaProvider(base, _env("LLM_MODEL", "llama3.1"))

    # Generic OpenAI-compatible (Groq, Together, local vLLM …)
    if _env("LLM_BASE_URL"):
        return OpenAICompatibleProvider(
            _env("LLM_BASE_URL"),
            _env("LLM_API_KEY"),
            _env("LLM_MODEL", "default"),
        )

    return MockProvider()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _hermes_active() -> bool:
    """Return True if HERMES_AGENT_URL is set and non-empty."""
    return bool(hermes_config.HERMES_AGENT_URL)


def active_engine() -> str:
    """Snapshot the active engine label (for /health)."""
    if _hermes_active():
        return f"hermes-{hermes_config.HERMES_MODEL}"
    return build_provider().active_engine_label()


async def llm_complete(
    system_message: str,
    user_message: str,
    tier: str = "fast",
    session_id: Optional[str] = None,  # noqa: F841 — kept for backward compat
    max_tokens: int = 800,
    temperature: float = 0.3,
) -> str:
    """Single-shot completion. tier: 'fast'/'smart' (same provider), 'hermes'."""
    provider = build_provider(tier if tier == "hermes" else "default")
    try:
        result = await provider.complete(system_message, user_message,
                                         max_tokens=max_tokens, temperature=temperature)
        return result if result else _mock_text(system_message, user_message)
    except Exception as exc:
        logger.error("LLM completion error: %s", exc)
        return _mock_text(system_message, user_message)


def _mock_text(system_message: str = "", user_message: str = "") -> str:
    sys_lower = system_message.lower()
    user_lower = user_message.lower()

    if "interview" in sys_lower or "interview" in user_lower:
        return json.dumps({
            "company": "TechCorp",
            "role": "Software Engineer",
            "commonly_asked": [
                {
                    "question": "Tell me about yourself.",
                    "category": "behavioral",
                    "why_asked": "To understand background.",
                    "how_to_answer": "Focus on achievements."
                }
            ],
            "recent_topics": ["Python", "FastAPI", "System Design"],
            "red_flags_to_avoid": ["Not coding"],
            "preparation_focus": ["FastAPI", "Database Indexing"],
            "source_note": "AI-generated from model knowledge."
        })

    if "optimize" in sys_lower or "optimize" in user_lower:
        if "<<<meta>>>" in user_lower or "exactly this format" in user_lower or "meta" in user_lower:
            return (
                "<<<META>>>\n"
                '{"changes": ["Added action verbs", "Quantified achievements", "Matched keywords"], '
                '"keywords_added": ["Python", "FastAPI", "Docker"], "estimated_score": 80}\n'
                "<<<RESUME>>>\n"
                "John Doe\n"
                "Senior Software Engineer\n"
                "Email: john@example.com | Phone: (555) 123-4567\n\n"
                "SUMMARY:\n"
                "Experienced Senior Software Engineer with a proven track record of designing and building scalable microservices and APIs using Python, FastAPI, and Docker. Strong background in cloud engineering and database optimization.\n\n"
                "EXPERIENCE:\n"
                "- Led team of 5 engineers to deliver high performance Python backend services.\n"
                "- Wrote optimized SQL queries improving database throughput by 50%.\n"
                "- Built CI/CD automation pipelines reducing deployment cycles.\n"
                "<<<END>>>"
            )

    if "ats" in sys_lower or "ats" in user_lower or "analyze" in sys_lower or "analyze" in user_lower:
        return json.dumps({
            "overall_score": 85,
            "section_scores": {
                "skills_match": 80,
                "experience_relevance": 85,
                "education_fit": 90,
                "formatting": 95
            },
            "matched_keywords": ["Python", "FastAPI", "Docker"],
            "missing_keywords": ["Kubernetes"],
            "keyword_buckets": {
                "must_have": [{"term": "Python", "present": True}],
                "preferred": [{"term": "Docker", "present": True}],
                "soft": [{"term": "Communication", "present": True}]
            },
            "weak_bullets": [{"original": "Helped team", "match": "implied", "rewrite": "Led team of 5 devs"}],
            "formatting_checks": {
                "single_column": True,
                "standard_headings": True,
                "acronyms_expanded": True,
                "no_tables_or_graphics": True,
                "notes": "Formatting is solid."
            },
            "recommendations": ["Add metrics to experience section"],
            "ats_issues": [],
            "summary": "Overall very good resume for this position."
        })

    return json.dumps({
        "score": 75,
        "changes": ["Added action verbs", "Quantified achievements", "Matched keywords"],
        "keywords_added": ["Python", "FastAPI", "Docker"],
        "estimated_score": 80,
    })


# ---------------------------------------------------------------------------
# JSON utilities
# ---------------------------------------------------------------------------

def extract_json(text: str):
    """Robustly extract a JSON object/array from an LLM response."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                continue
    logger.error("Failed to parse JSON from LLM response: %s", text[:400])
    raise ValueError("LLM returned unparseable JSON")


async def llm_json(system_message: str, user_message: str,
                   tier: str = "fast") -> dict | list:
    """Complete and parse response as JSON. Adds JSON instruction to system prompt."""
    sys2 = (system_message +
            "\n\nIMPORTANT: Respond with ONLY a single valid JSON value. "
            "No markdown fences, no commentary, no preface.")
    raw = await llm_complete(sys2, user_message, tier=tier, max_tokens=1200)
    return extract_json(raw)


# ---------------------------------------------------------------------------
# Task helpers (ported from archive, adapted to use llm_json above)
# ---------------------------------------------------------------------------

def _clip(text: str, n: int = 9000) -> str:
    text = text or ""
    return text if len(text) <= n else text[:n] + "\n...[truncated]"


async def interview_questions(profile_summary: str, application: dict, jd: str = "") -> dict:
    """Generate per-application interview intelligence (ported from archive llm_service.py)."""
    system = (
        "You are an interview intelligence engine. For a given company + role, surface the "
        "questions candidates most frequently report being asked (behavioral, technical, "
        "role-specific), grounded in the job description and the company's known interview style. "
        "Be specific and practical."
    )
    user = f"""Generate the interview question intel for this application.

COMPANY: {application.get('company', '')}
ROLE: {application.get('title', '')}
JOB DESCRIPTION: {_clip(jd or application.get('notes', ''), 3500)}
CANDIDATE PROFILE: {_clip(profile_summary, 1500)}

Return JSON:
{{
  "company": "", "role": "",
  "commonly_asked": [{{"question": "", "category": "behavioral|technical|role|culture|system-design", "why_asked": "", "how_to_answer": ""}}],
  "recent_topics": ["<themes/skills currently emphasized for this role/company>"],
  "red_flags_to_avoid": ["<strings>"],
  "preparation_focus": ["<top areas to study>"],
  "source_note": "AI-generated from model knowledge + the job description."
}}"""
    return await llm_json(system, user)


async def summarize_saved_post(url: str, note: str = "", source: str = "") -> dict:
    """Categorize and summarize a saved web item for the Knowledge Hub."""
    system = (
        "You categorize and summarize a saved web item (LinkedIn/Medium/Substack/etc.) "
        "for a job seeker's personal knowledge hub. Infer intent from the URL and the user's "
        "note. If you cannot infer content, rely on the user's note."
    )
    user = f"""Saved item:
URL: {url}
SOURCE: {source or 'unknown'}
USER NOTE: {note or 'none'}

Return JSON:
{{
  "title": "<best-guess concise title>",
  "summary": "<1-2 sentence summary or 'Open the link for details' if unknown>",
  "tags": ["<short topical tags>"],
  "category": "interview-questions|career-advice|technical|company-research|networking|other",
  "is_interview_related": <true|false>
}}"""
    return await llm_json(system, user)


async def parse_application_email(email_text: str) -> dict:
    """Parse a recruiter email into structured Kanban tracking data."""
    system = (
        "You parse job-application related emails into structured tracking data. "
        "Map the email to the correct pipeline stage."
    )
    stages = "saved, applied, phone_screen, interview, offer, rejected"
    user = f"""Parse this email. Stages: {stages}.

EMAIL:
{_clip(email_text, 6000)}

Return JSON:
{{
  "is_job_related": <true|false>,
  "company": "", "title": "", "location": "",
  "stage": "saved|applied|phone_screen|interview|offer|rejected",
  "interview_date": "<ISO 8601 or null>",
  "contact": "<recruiter/contact name or email or null>",
  "summary": "<1 sentence of what the email says>"
}}"""
    return await llm_json(system, user)


async def extract_profile_from_resume(resume_text: str) -> dict:
    """Extract structured profile data from resume text."""
    system = "You extract structured profile data from a resume. Be accurate; use null/empty when unknown."
    user = f"""Extract a profile from this resume.

RESUME:
{_clip(resume_text)}

Return JSON:
{{
  "full_name": "", "headline": "", "location": "", "email": "", "phone": "",
  "current_role": "", "years_experience": <number or 0>,
  "skills": ["<strings>"], "target_roles": ["<likely next roles>"],
  "summary": "<2 sentence professional summary>"
}}"""
    return await llm_json(system, user)


def ats_compliance(text: str) -> dict:
    t = text or ""
    low = t.lower()
    SECTIONS = ["experience", "education", "skills", "summary", "projects", "certification", "work"]
    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", t))
    has_phone = bool(re.search(r"(\+?\d[\d\s().-]{7,}\d)", t))
    sections_found = sorted({s for s in SECTIONS if s in low})
    bullets = len(re.findall(r"(^|\n)\s*[-*\u2022\u00b7]", t))
    words = len(t.split())
    quantified = len(re.findall(r"\d+%|\$\s?\d|\b\d{2,}\b", t))
    has_tabs = "\t" in t
    checks = [
        {"label": "Contact email is parseable", "pass": has_email},
        {"label": "Phone number present", "pass": has_phone},
        {"label": "Has \u2265 3 standard sections", "pass": len(sections_found) >= 3},
        {"label": "Uses bullet points", "pass": bullets >= 3},
        {"label": "Length is ATS-friendly (250\u20131200 words)", "pass": 250 <= words <= 1200},
        {"label": "Quantified achievements present", "pass": quantified >= 3},
        {"label": "No tab/column artifacts", "pass": not has_tabs},
    ]
    passed = sum(1 for c in checks if c["pass"])
    return {
        "score": round(passed / len(checks) * 100),
        "passed": passed,
        "total": len(checks),
        "checks": checks,
        "sections_found": sections_found,
        "word_count": words,
        "bullet_count": bullets,
    }


async def analyze_resume(resume_text: str, jd: str, custom_instructions: str = "") -> dict:
    system = (
        "You are an expert technical recruiter and a 2026-era semantic ATS analyzer. "
        "Modern ATS use transformer embeddings and reward context, not bare keyword lists. "
        "Apply the hybrid methodology: Exact terms (for must-haves) + Semantic variants + Proof "
        "(measurable outcomes). Reward bullets that follow Problem -> Action -> Result. "
        "Be rigorous and honest; never inflate scores."
    )
    user = f"""Analyze this resume against the job description using 2026 semantic-ATS best practices.

RESUME:
{_clip(resume_text)}

JOB DESCRIPTION:
{_clip(jd)}

USER CUSTOM INSTRUCTIONS (consider these): {custom_instructions or 'none'}

Return JSON with this exact shape:
{{
  "overall_score": <int 0-100>,
  "section_scores": {{"skills_match": <int>, "experience_relevance": <int>, "education_fit": <int>, "formatting": <int>}},
  "matched_keywords": [<strings present in BOTH resume and JD>],
  "missing_keywords": [<important JD keywords missing from resume>],
  "keyword_buckets": {{
     "must_have": [{{"term": "<critical skill/cert/tool>", "present": <true|false>}}],
     "preferred": [{{"term": "<secondary skill>", "present": <true|false>}}],
     "soft": [{{"term": "<action verb/soft skill/domain term>", "present": <true|false>}}]
  }},
  "weak_bullets": [{{"original": "<a weak resume bullet>", "match": "direct|implied|none", "rewrite": "<Action + Tool/Method + Measurable Outcome + Scope>"}}],
  "formatting_checks": {{
     "single_column": <true|false>, "standard_headings": <true|false>,
     "acronyms_expanded": <true|false>, "no_tables_or_graphics": <true|false>,
     "notes": "<short formatting guidance>"
  }},
  "recommendations": [<specific, actionable improvements>],
  "ats_issues": [<formatting/parsing problems that hurt ATS>],
  "summary": "<2-3 sentence honest assessment>"
}}"""
    result = await llm_json(system, user)
    if isinstance(result, dict):
        result["ats_compliance"] = ats_compliance(resume_text)
    return result

