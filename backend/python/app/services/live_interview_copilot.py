"""
Real-Time Live Interview Audio Overlay Copilot Service.
Processes incoming live interviewer audio snippets / text transcripts and generates instant,
bulleted STAR framework answer hints, technical code concepts, and metric reminders.
"""
from __future__ import annotations
import asyncio
import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from app.services.llm_service import llm_complete


class LiveCopilotRequest(BaseModel):
    interviewer_transcript: str = Field(default="Can you describe a challenging project you delivered?", description="Transcribed interviewer text snippet")
    question: Optional[str] = Field(default=None)
    job_title: str = Field(default="Software Engineer")
    company_name: Optional[str] = Field(default=None)
    candidate_resume_summary: Optional[str] = Field(default=None)
    target_skills: List[str] = Field(default_factory=list)

    def model_post_init(self, __context: Any) -> None:
        if self.question and not self.interviewer_transcript:
            self.interviewer_transcript = self.question


class LiveCopilotResponse(BaseModel):
    detected_question_type: str = Field(description="Behavioral, Technical, System Design, or General")
    instant_hints: List[str] = Field(default_factory=list, description="Immediate 1-sentence bullet points")
    star_framework: Dict[str, str] = Field(default_factory=dict, description="S/T/A/R structural outline")
    suggested_metrics: List[str] = Field(default_factory=list, description="Key resume metric callouts")


async def generate_live_copilot_hints(req: LiveCopilotRequest) -> LiveCopilotResponse:
    """
    Generate instant <3-second candidate response hints for live interview stream.
    """
    prompt = (
        f"You are a real-time live interview copilot assisting a candidate interviewing for {req.job_title} at {req.company_name or 'a tech company'}.\n"
        f"Interviewer just asked: \"{req.interviewer_transcript}\"\n\n"
        f"Candidate Resume Highlights: {req.candidate_resume_summary or 'Experienced software engineer with track record of high scalability and performance'}.\n"
        f"Target Skills: {', '.join(req.target_skills[:5]) if req.target_skills else 'Python, Go, System Design, SQL'}.\n\n"
        f"Provide an immediate concise guidance JSON object with format:\n"
        f"{{\n"
        f'  "detected_question_type": "Behavioral" | "Technical" | "System Design",\n'
        f'  "instant_hints": ["Hint 1", "Hint 2"],\n'
        f'  "star_framework": {{"situation": "...", "task": "...", "action": "...", "result": "..."}},\n'
        f'  "suggested_metrics": ["Reduced latency by 45%", "Scaled to 1M daily users"]\n'
        f"}}\n"
    )

    try:
        raw_res = await llm_complete(prompt=prompt, system_prompt="You are a fast live interview assistant. Output valid JSON only.")
        import json
        clean_json = raw_res.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
        data = json.loads(clean_json.strip())
        return LiveCopilotResponse(
            detected_question_type=data.get("detected_question_type", "General"),
            instant_hints=data.get("instant_hints", ["Focus on clear impact", "Mention specific technologies used"]),
            star_framework=data.get("star_framework", {
                "situation": "Briefly describe context at previous role",
                "task": "Highlight key problem or challenge",
                "action": "Detail your specific individual contribution",
                "result": "State quantitative impact and metrics"
            }),
            suggested_metrics=data.get("suggested_metrics", ["Improved system throughput", "Delivered on schedule"])
        )
    except Exception as e:
        # Fallback instant hints if LLM fails or is offline
        return LiveCopilotResponse(
            detected_question_type="Behavioral/Technical",
            instant_hints=[
                "Start with a 1-sentence executive summary of your answer.",
                "Structure using STAR: Situation -> Task -> Action -> Result.",
                f"Highlight relevant experience in {', '.join(req.target_skills[:2]) if req.target_skills else 'software architecture'}."
            ],
            star_framework={
                "situation": "Set the scene and context",
                "task": "Explain the objective",
                "action": "Step-by-step actions you performed",
                "result": "Measurable metrics achieved"
            },
            suggested_metrics=["Increased performance by 35%", "Zero-downtime deployment"]
        )


class CopilotHintRequest(BaseModel):
    interviewer_transcript: str = Field(default="", description="Transcribed interviewer text snippet")
    target_role: Optional[str] = Field(default=None)
    job_title: Optional[str] = Field(default=None)
    company_name: Optional[str] = Field(default=None)
    candidate_resume_summary: Optional[str] = Field(default=None)
    target_skills: List[str] = Field(default_factory=list)


async def generate_interview_hint(req: CopilotHintRequest) -> LiveCopilotResponse:
    """Single-shot STAR hint generation (plain HTTP path)."""
    kwargs: Dict[str, Any] = dict(
        job_title=req.target_role or req.job_title or "Software Engineer",
        company_name=req.company_name,
        candidate_resume_summary=req.candidate_resume_summary,
        target_skills=req.target_skills,
    )
    transcript = (req.interviewer_transcript or "").strip()
    if transcript:
        kwargs["interviewer_transcript"] = transcript
    live_req = LiveCopilotRequest(**kwargs)
    return await generate_live_copilot_hints(live_req)


class VoiceAnalysisRequest(BaseModel):
    transcript: str = Field(default="", description="Candidate's spoken answer transcript")
    duration_seconds: float = Field(default=15.0)
    target_role: Optional[str] = Field(default=None)


class VoiceAnalysisResponse(BaseModel):
    wpm: int
    wpm_status: str
    filler_word_count: int
    filler_words_found: Dict[str, int]
    star_breakdown: Dict[str, str]
    coaching_tips: List[str]


_FILLER_WORDS = ("um", "uh", "like", "you know", "basically", "actually", "sort of", "kind of")


def analyze_candidate_speech(req: VoiceAnalysisRequest) -> VoiceAnalysisResponse:
    """Deterministic cadence/filler analysis (no LLM — never mock, never 503)."""
    words = [w for w in req.transcript.lower().split() if w]
    duration = max(req.duration_seconds, 1.0)
    wpm = int(round(len(words) / (duration / 60.0))) if words else 0
    if wpm == 0:
        wpm_status = "no speech detected"
    elif wpm < 110:
        wpm_status = "slow"
    elif wpm <= 160:
        wpm_status = "good"
    else:
        wpm_status = "fast"

    lower = req.transcript.lower()
    filler_counts: Dict[str, int] = {}
    for filler in _FILLER_WORDS:
        count = len(re.findall(rf"\b{re.escape(filler)}\b", lower))
        if count:
            filler_counts[filler] = count

    star_breakdown = {
        "situation": "Present" if any(k in lower for k in ("at ", "in my", "when i", "during")) else "Missing",
        "task": "Present" if any(k in lower for k in ("needed to", "had to", "goal", "objective", "task")) else "Missing",
        "action": "Present" if any(k in lower for k in ("i ", "we ", "built", "led", "designed", "implemented")) else "Missing",
        "result": "Present" if any(k in lower for k in ("result", "outcome", "improved", "reduced", "increased", "%")) else "Missing",
    }

    tips = []
    if wpm and wpm < 110:
        tips.append("Pace is slow — aim for 120-150 words per minute.")
    if wpm > 160:
        tips.append("Pace is fast — slow down for clarity.")
    if filler_counts:
        top = max(filler_counts, key=filler_counts.get)
        tips.append(f"Most-used filler: \"{top}\" — pause instead.")
    missing = [k for k, v in star_breakdown.items() if v == "Missing"]
    if missing:
        tips.append(f"STAR gap: {', '.join(missing)} not clearly covered.")
    if not tips:
        tips.append("Strong cadence and STAR coverage — keep it up.")

    return VoiceAnalysisResponse(
        wpm=wpm,
        wpm_status=wpm_status,
        filler_word_count=sum(filler_counts.values()),
        filler_words_found=filler_counts,
        star_breakdown=star_breakdown,
        coaching_tips=tips,
    )


async def stream_live_copilot_hints(req: LiveCopilotRequest):
    """Async generator of progressive SSE events for the live copilot stream.

    Yields dicts: {"type": "question_type"|"hints"|"star"|"metrics"|"done"|"error"}.
    LLMNotConfiguredError propagates as an error event — never canned output.
    """
    from app.services.llm_service import LLMNotConfiguredError

    prompt = (
        f"You are a real-time live interview copilot assisting a candidate interviewing for {req.job_title} at {req.company_name or 'a tech company'}.\n"
        f"Interviewer just asked: \"{req.interviewer_transcript}\"\n\n"
        f"Candidate Resume Highlights: {req.candidate_resume_summary or 'Experienced software engineer with track record of high scalability and performance'}.\n"
        f"Target Skills: {', '.join(req.target_skills[:5]) if req.target_skills else 'Python, Go, System Design, SQL'}.\n\n"
        f"Provide an immediate concise guidance JSON object with format:\n"
        f"{{\n"
        f'  "detected_question_type": "Behavioral" | "Technical" | "System Design",\n'
        f'  "instant_hints": ["Hint 1", "Hint 2"],\n'
        f'  "star_framework": {{"situation": "...", "task": "...", "action": "...", "result": "..."}},\n'
        f'  "suggested_metrics": ["Reduced latency by 45%", "Scaled to 1M daily users"]\n'
        f"}}\n"
    )

    try:
        raw_res = await llm_complete(prompt=prompt, system_prompt="You are a fast live interview assistant. Output valid JSON only.")
    except LLMNotConfiguredError as exc:
        yield {"type": "error", "error": "ai_service_unavailable", "message": "LLM not configured"}
        return
    except Exception as exc:
        yield {"type": "error", "error": "copilot_failed", "message": str(exc)}
        return

    import json
    clean_json = raw_res.strip()
    if clean_json.startswith("```json"):
        clean_json = clean_json[7:]
    if clean_json.endswith("```"):
        clean_json = clean_json[:-3]
    try:
        data = json.loads(clean_json.strip())
    except Exception as exc:
        yield {"type": "error", "error": "llm_output_invalid", "message": str(exc)}
        return

    yield {"type": "question_type", "value": data.get("detected_question_type", "General")}
    yield {"type": "hints", "value": data.get("instant_hints", [])}
    yield {"type": "star", "value": data.get("star_framework", {})}
    yield {"type": "metrics", "value": data.get("suggested_metrics", [])}
    yield {"type": "done"}
