"""
Communication Suite — AI-generated follow-up, thank-you, negotiation, status-check emails.
Updated with Career-Ops Voice DNA guardrails.
"""
import re
from typing import Dict, Any, List, Optional
from app.services.llm_service import llm_complete
from app.services.prompt_safety import untrusted, UNTRUSTED_INSTRUCTION


class CommunicationGenerator:
    TIMING_NOTES = {
        "follow-up": "Best sent 3-5 days after application for startups, 7-10 days for large enterprises.",
        "thank-you": "Send within 24 hours of the interview. Same day is ideal.",
        "negotiation": "Send within 2-3 days of receiving the offer. Express enthusiasm before negotiating.",
        "status-check": "Send 1-2 weeks after the last interaction if no response.",
    }

    @staticmethod
    async def generate(
        comm_type: str,
        resume_text: str,
        job_title: str,
        company_name: str,
        recipient_name: Optional[str] = None,
        discussion_points: Optional[List[str]] = None,
        offer_details: Optional[Dict[str, Any]] = None,
        days_since: int = 3,
    ) -> Dict[str, Any]:
        if comm_type == "follow-up":
            return await CommunicationGenerator._follow_up(job_title, company_name, days_since)
        elif comm_type == "thank-you":
            return await CommunicationGenerator._thank_you(job_title, company_name, recipient_name, discussion_points)
        elif comm_type == "negotiation":
            return await CommunicationGenerator._negotiation(job_title, company_name, resume_text, offer_details)
        elif comm_type == "status-check":
            return await CommunicationGenerator._status_check(job_title, company_name, days_since)
        else:
            return await CommunicationGenerator._follow_up(job_title, company_name, days_since)

    @staticmethod
    async def _follow_up(job_title: str, company_name: str, days_since: int) -> Dict[str, Any]:
        system = "You are a career communications expert." + UNTRUSTED_INSTRUCTION
        prompt = f"""Write a polite, warm, conversational follow-up email about the application I sent {days_since} days ago.

        COMPANY:
        {untrusted(company_name)}
        ROLE:
        {untrusted(job_title)}
        
        Voice DNA & Guardrails:
        - 3-4 sentences max, under 150 words.
        - Conversational tone: use contractions, varied rhythm, direct "I" and "you".
        - NEVER use clichés like "just checking in", "just following up", "touching base", "circling back", or "I hope this email finds you well".
        - Lead with a soft ask / availability ("Would any time this week work for a brief call?").
        
        Return ONLY the email body (no subject line)."""
        body = await llm_complete(system, prompt, max_tokens=300, temperature=0.6)
        return {
            "subject": f"Re: {job_title} application — {company_name}",
            "body": body.strip(),
            "word_count": len(body.split()),
            "type": "follow-up",
            "timing_note": CommunicationGenerator.TIMING_NOTES["follow-up"],
        }

    @staticmethod
    async def _thank_you(job_title: str, company_name: str, recipient_name: Optional[str] = None, discussion_points: Optional[List[str]] = None) -> Dict[str, Any]:
        recipient = recipient_name or "the interviewer"
        points_text = ""
        if discussion_points:
            points_text = "We discussed: " + "; ".join(discussion_points[:3]) + "."

        system = "You are a career communications expert." + UNTRUSTED_INSTRUCTION
        prompt = f"""Write a post-interview thank-you email for the interview.
        RECIPIENT:
        {untrusted(recipient)}
        COMPANY:
        {untrusted(company_name)}
        ROLE:
        {untrusted(job_title)}
        DISCUSSION:
        {untrusted(points_text)}
        
        Voice DNA & Guardrails:
        - Under 200 words.
        - Reference specific discussion points naturally.
        - Reiterate genuine excitement for the specific problem/team.
        - Conversational and punchy.
        
        Return ONLY the email body (no subject line)."""
        body = await llm_complete(system, prompt, max_tokens=350, temperature=0.6)
        return {
            "subject": f"Thank you — {job_title} interview ({company_name})",
            "body": body.strip(),
            "word_count": len(body.split()),
            "type": "thank-you",
            "timing_note": CommunicationGenerator.TIMING_NOTES["thank-you"],
        }

    @staticmethod
    async def _negotiation(job_title: str, company_name: str, resume_text: str, offer_details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        base = offer_details.get("base_salary", 0) if offer_details else 0
        target_range = offer_details.get("target_range", [base * 1.1, base * 1.15]) if offer_details else [0, 0]

        # Extract 3 achievements with metrics from resume
        achievements = []
        metric_pattern = re.compile(r'\b(reduced|increased|improved|led|launched|built|shipped|grew|saved|cut|boosted|optimized|designed|implemented|delivered|achieved|spearheaded).+?\d+%?|\$?\d+[KkMmBb]?\b', re.IGNORECASE)
        for line in resume_text.split("\n"):
            line = line.strip()
            if len(line) > 20 and metric_pattern.search(line):
                achievements.append(line[:140])
            if len(achievements) >= 3:
                break

        achievements_text = "\n".join([f"{i+1}. {a}" for i, a in enumerate(achievements[:3])])

        prompt = f"""Draft a salary negotiation email for the {job_title} role at {company_name}.
        
        Current offer base: ${base:,}
        Target range: ${target_range[0]:,} — ${target_range[1]:,}
        
        My key achievements:
        {achievements_text}
        
        Requirements (5R Framework):
        1. Role: reference the job title and level.
        2. Range: state the current offer and target range clearly.
        3. Receipts: use 2-3 specific achievements as leverage.
        4. Risk: mention that I have other opportunities but prefer this company (softly).
        5. Request: make a specific ask with clear rationale.
        
        Voice DNA & Guardrails:
        - Keep under 200 words.
        - Be respectful but firm.
        - Express enthusiasm for the role.
        - Natural, conversational but professional tone (no desperate clichés).
        
        Return ONLY the email body (no subject line)."""
        body = await llm_complete("", prompt, max_tokens=600, temperature=0.7)
        return {
            "subject": f"Regarding {job_title} offer — compensation discussion",
            "body": body.strip(),
            "word_count": len(body.split()),
            "type": "negotiation",
            "timing_note": CommunicationGenerator.TIMING_NOTES["negotiation"],
            "talking_points": achievements[:3],
        }

    @staticmethod
    async def _status_check(job_title: str, company_name: str, days_since: int) -> Dict[str, Any]:
        prompt = f"""Write a brief status-check email about the {job_title} application at {company_name}. It has been {days_since} days since my last interaction.
        
        Voice DNA & Guardrails:
        - Under 100 words.
        - Be polite and understanding.
        - Ask if there's any update on the timeline or if they need any additional information.
        - Natural, conversational tone (no clichés like "touching base", "circling back").
        
        Return ONLY the email body (no subject line)."""
        body = await llm_complete("", prompt, max_tokens=250, temperature=0.6)
        return {
            "subject": f"Checking in — {job_title} application",
            "body": body.strip(),
            "word_count": len(body.split()),
            "type": "status-check",
            "timing_note": CommunicationGenerator.TIMING_NOTES["status-check"],
        }
