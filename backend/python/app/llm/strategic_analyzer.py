"""
Strategic analysis using an LLM (optional / configurable).
This layer is SUGGESTIVE — it does NOT generate final text.
"""
import os
import json
import re
from typing import Optional, List, Dict, Any

import httpx

from app.schemas import StrategicAnalysisResponse, HiddenSkill


class StrategicAnalyzer:
    """LLM-powered strategic layer. All LLM calls are optional with graceful fallbacks."""

    def __init__(self):
        self.llm_url = os.getenv("LLM_API_URL", "")
        self.llm_api_key = os.getenv("LLM_API_KEY", "")

    async def analyze(
        self,
        resume_text: str,
        jd_text: str,
    ) -> StrategicAnalysisResponse:
        if not self.llm_url or not self.llm_api_key:
            return self._fallback_analysis(resume_text, jd_text)

        try:
            return await self._llm_analysis(resume_text, jd_text)
        except Exception as exc:  # pylint: disable=broad-except
            print(f"[StrategicAnalyzer] LLM call failed: {exc}, falling back")
            return self._fallback_analysis(resume_text, jd_text)

    async def _llm_analysis(self, resume_text: str, jd_text: str) -> StrategicAnalysisResponse:
        """
        Prompts the LLM with a restrictive, structured prompt.
        Returns only structured JSON matching our schema.
        """
        prompt = (
            "You are a strategic career advisor. Analyze the resume against the job description.\n"
            "IMPORTANT RULES:\n"
            "1. Do NOT generate full sentences or rewrite the resume.\n"
            "2. Only provide structured suggestions, hidden skills evidence, and templates.\n"
            "3. Templates must be bracket placeholders like: [Action] [metric] using [tool].\n"
            "\n--- RESUME ---\n"
            f"{resume_text[:4000]}\n"
            "\n--- JOB DESCRIPTION ---\n"
            f"{jd_text[:4000]}\n"
            "\nRespond ONLY in JSON matching this structure (no markdown):\n"
            "{"
            '  "hidden_skills": [{"skill": "", "evidence": "", "confidence": "high/medium/low"}],'
            '  "strengths": [""],'
            '  "templates": [""],'
            '  "placement_recommendations": [""],'
            '  "ai_risk_flags": [""]'
            "}"
        )

        payload = {
            "model": "default" if "openrouter" not in self.llm_url else "openrouter/anthropic/claude-3-haiku",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0,
        }
        headers = {"Content-Type": "application/json"}
        if self.llm_api_key:
            if "anthropic" in self.llm_url.lower() or "openrouter" in self.llm_url.lower():
                headers["Authorization"] = f"Bearer {self.llm_api_key}"
            else:
                headers["x-api-key"] = self.llm_api_key

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.llm_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        # Try to extract JSON from response
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return self._parse_llm_response(content)

    def _parse_llm_response(self, content: str) -> StrategicAnalysisResponse:
        """Robustly parse JSON from LLM response."""
        try:
            # Strip markdown fences if present
            clean = re.sub(r"```(?:json)?", "", content).strip()
            clean = clean.replace("```", "").strip()
            parsed = json.loads(clean)

            hidden_skills = [
                HiddenSkill(**hs) for hs in parsed.get("hidden_skills", [])
            ]
            return StrategicAnalysisResponse(
                hidden_skills=hidden_skills,
                strengths=parsed.get("strengths", []),
                templates=parsed.get("templates", []),
                placement_recommendations=parsed.get("placement_recommendations", []),
                ai_risk_flags=parsed.get("ai_risk_flags", []),
            )
        except (json.JSONDecodeError, TypeError) as exc:
            print(f"[StrategicAnalyzer] Failed to parse LLM output: {exc}")
            return self._fallback_analysis("", "")

    @staticmethod
    def _fallback_analysis(resume_text: str, jd_text: str) -> StrategicAnalysisResponse:
        """Fallback analysis when no LLM is available."""
        return StrategicAnalysisResponse(
            hidden_skills=[],
            strengths=["No LLM configured. Please set LLM_API_URL and LLM_API_KEY for deeper insights."],
            templates=[
                "[Action verb] [quantifiable result] by [method] using [tool/technology].",
                "Led [initiative] resulting in [metric], leveraging [skill/tool].",
                "Collaborated with [team size] to [deliver] [outcome] within [timeframe].",
            ],
            placement_recommendations=[
                "Emphasize metrics in the experience section.",
                "Add a zwischennotes to make results tangible.",
            ],
            ai_risk_flags=["LLM analysis not available. Generic analysis mode."],
        )
