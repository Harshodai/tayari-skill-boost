"""
Cover Letter Generator — resume-aware, culture-matched, short format.
Persists to `cover_letters` table when user context is provided.
"""
import logging
import re
import uuid
from typing import Dict, Any, List, Optional

from app.llm.long_context import LONG_TEXT_PLACEHOLDER, LongContextClient
from app.services.template_registry import TemplateRegistry

logger = logging.getLogger(__name__)

_template_registry = TemplateRegistry()


def get_template_registry() -> TemplateRegistry:
    """Return the global TemplateRegistry instance."""
    return _template_registry


def format_with_template(
    cover_letter_text: str,
    template_id: str,
    job_title: str = "",
    company_name: str = "",
) -> str:
    """Format cover letter text into a registered template (e.g. LaTeX, Typst)."""
    tmpl = _template_registry.get_template(template_id)
    if not tmpl:
        return cover_letter_text

    raw = tmpl.get("template_content", "")
    if "{{content}}" in raw:
        return raw.replace("{{content}}", cover_letter_text)
    if "{{cover_letter}}" in raw:
        return raw.replace("{{cover_letter}}", cover_letter_text)

    engine = tmpl.get("engine", "")
    if engine == "latex":
        return (
            f"{raw}\n\n"
            f"% Cover Letter: {job_title} at {company_name}\n"
            f"{cover_letter_text}"
        )
    elif engine == "typst":
        return f"{raw}\n\n= Cover Letter\n\n{cover_letter_text}"
    return f"{raw}\n\n{cover_letter_text}"


class CoverLetterGenerator:
    TONES = {
        "formal": "formal and professional",
        "casual": "conversational, relaxed, and approachable — like a friendly email to a colleague",
        "confident": "confident and assertive",
        "technical": "engineering-focused and systems-oriented — emphasize technical depth, architecture decisions, and domain expertise",
    }

    format_with_template = staticmethod(format_with_template)

    @staticmethod
    async def save(
        user_id: str,
        content: str,
        job_title: str = "",
        company_name: str = "",
        job_url: str = "",
        resume_id: Optional[str] = None,
        cover_letter_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Persist a cover letter to the cover_letters database table."""
        from app.services.db import get_pool
        pool = await get_pool()
        if not pool:
            return None
        cl_id = cover_letter_id or str(uuid.uuid4())
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO cover_letters (id, user_id, job_title, company_name, content, job_url, resume_id)
                    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid)
                    RETURNING id, user_id, job_title, company_name, content, job_url, resume_id, created_at, updated_at
                    """,
                    cl_id,
                    user_id,
                    job_title,
                    company_name,
                    content,
                    job_url,
                    resume_id,
                )
                if row:
                    return dict(row)
        except Exception as exc:
            logger.warning("Failed to save cover letter: %s", exc)
        return None

    @staticmethod
    async def generate(
        resume_text: str,
        job_description: str,
        company_name: str,
        job_title: str,
        tone: str = "formal",
        personal_notes: str = "",
        template_id: Optional[str] = None,
        user_id: Optional[str] = None,
        user_context: Optional[Dict[str, Any]] = None,
        job_url: Optional[str] = None,
        resume_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        tone_desc = CoverLetterGenerator.TONES.get(tone, CoverLetterGenerator.TONES["formal"])

        # ponytail: personal_notes = what the user knows about the company/role
        # that the AI can't infer (a referral, a recent product launch, a shared
        # value, a conversation at a meetup). Injecting it is the difference
        # between a generic AI letter and one a hiring manager can't detect.
        notes_block = f"\nCandidate's personal notes (use 1-2 of these, in the user's voice — do NOT invent beyond them):\n{personal_notes[:500]}\n" if personal_notes.strip() else ""

        jd_condensed = (
            await LongContextClient().condense(job_description, kind="jd")
            if job_description.strip()
            else ""
        )

        # ponytail: chunked via long_context (spec 2026-08-02) — the resume
        # reaches the LLM in full through the {LONG_TEXT} slot, the JD arrives
        # condensed, instead of [:2000]/[:3000] head-slices.
        from app.services.prompt_safety import untrusted, UNTRUSTED_INSTRUCTION

        prompt = f"""You are an expert career coach writing a cover letter.{UNTRUSTED_INSTRUCTION}

Job Title:
{untrusted(job_title)}
Company:
{untrusted(company_name)}
Tone: {tone_desc}

Job Description:
{untrusted(jd_condensed)}

Candidate Resume:
{LONG_TEXT_PLACEHOLDER}
{untrusted(notes_block)}

Instructions:
- Write a 3-paragraph cover letter under 300 words.
- Paragraph 1: Why this role at this company (show genuine interest, mention 1 specific company detail if possible).
- Paragraph 2: Key experience match (reference 1-2 specific resume bullets with metrics).
- Paragraph 3: Enthusiasm + call to action (request an interview).
- Tone must be {tone_desc}.
- Do NOT include addresses, dates, or "Dear Hiring Manager" placeholders. Start with a professional greeting and the body.
- Do NOT fabricate experience not in the resume.

Return ONLY the cover letter text."""

        cover_letter = await LongContextClient().map_reduce(
            resume_text,
            prompt,
            kind="resume",
            max_tokens=800,
            temperature=0.7,
        )

        # Extract bullet references (sentences with metrics)
        bullet_refs = []
        metric_pattern = re.compile(r'\b(reduced|increased|improved|led|launched|built|shipped|grew|saved|cut|boosted|optimized|designed|implemented|delivered|achieved|spearheaded).+?\d+%?|\$?\d+[KkMmBb]?\b', re.IGNORECASE)
        for line in resume_text.split("\n"):
            line = line.strip()
            if len(line) > 20 and metric_pattern.search(line):
                bullet_refs.append(line[:120])
            if len(bullet_refs) >= 3:
                break

        clean_letter = cover_letter.strip()
        word_count = len(clean_letter.split())
        letter_id = str(uuid.uuid4())

        result: Dict[str, Any] = {
            "id": letter_id,
            "cover_letter": clean_letter,
            "word_count": word_count,
            "bullet_references": bullet_refs[:2],
            "tone": tone,
            "job_title": job_title,
            "company_name": company_name,
        }

        uid = user_id or (user_context.get("user_id") or user_context.get("id") if isinstance(user_context, dict) else None)
        if uid:
            result["user_id"] = str(uid)
            try:
                saved = await CoverLetterGenerator.save(
                    user_id=str(uid),
                    content=clean_letter,
                    job_title=job_title,
                    company_name=company_name,
                    job_url=job_url or (user_context.get("job_url") if isinstance(user_context, dict) else "") or "",
                    resume_id=resume_id or (user_context.get("resume_id") if isinstance(user_context, dict) else None),
                    cover_letter_id=letter_id,
                )
                if saved:
                    result["saved"] = True
                    if isinstance(saved, dict) and "id" in saved:
                        result["id"] = str(saved["id"])
            except Exception as e:
                logger.warning("CoverLetterGenerator.generate save failed: %s", e)

        if template_id:
            result["formatted_cover_letter"] = format_with_template(
                clean_letter,
                template_id=template_id,
                job_title=job_title,
                company_name=company_name,
            )
            result["template_id"] = template_id

        return result
