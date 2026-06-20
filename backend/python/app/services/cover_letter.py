"""
Cover Letter Generator — resume-aware, culture-matched, short format.
"""
import re
from typing import Dict, Any, List, Optional
from app.services.llm_service import llm_complete


class CoverLetterGenerator:
    TONES = {"formal": "formal and professional", "conversational": "conversational and approachable", "confident": "confident and assertive"}

    @staticmethod
    def generate(resume_text: str, job_description: str, company_name: str, job_title: str, tone: str = "formal") -> Dict[str, Any]:
        tone_desc = CoverLetterGenerator.TONES.get(tone, CoverLetterGenerator.TONES["formal"])

        prompt = f"""You are an expert career coach writing a cover letter.

Job Title: {job_title}
Company: {company_name}
Tone: {tone_desc}

Job Description:
{job_description[:2000]}

Candidate Resume:
{resume_text[:3000]}

Instructions:
- Write a 3-paragraph cover letter under 300 words.
- Paragraph 1: Why this role at this company (show genuine interest, mention 1 specific company detail if possible).
- Paragraph 2: Key experience match (reference 1-2 specific resume bullets with metrics).
- Paragraph 3: Enthusiasm + call to action (request an interview).
- Tone must be {tone_desc}.
- Do NOT include addresses, dates, or "Dear Hiring Manager" placeholders. Start with a professional greeting and the body.
- Do NOT fabricate experience not in the resume.

Return ONLY the cover letter text."""

        cover_letter = llm_complete(prompt, max_tokens=800, temperature=0.7)

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
