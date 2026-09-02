"""
Cover Letter Generator — resume-aware, culture-matched, short format.
"""
import re
from typing import Dict, Any, List, Optional

from app.llm.long_context import LONG_TEXT_PLACEHOLDER, LongContextClient


class CoverLetterGenerator:
    TONES = {"formal": "formal and professional", "conversational": "conversational and approachable", "confident": "confident and assertive"}

    @staticmethod
    async def generate(resume_text: str, job_description: str, company_name: str, job_title: str, tone: str = "formal", personal_notes: str = "") -> Dict[str, Any]:
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

        word_count = len(cover_letter.split())

        return {
            "cover_letter": cover_letter.strip(),
            "word_count": word_count,
            "bullet_references": bullet_refs[:2],
            "tone": tone,
            "job_title": job_title,
            "company_name": company_name,
        }
