from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.services.omnisave_evidence import get_omnisave_evidence_store


class OmniSaveBriefService:
    async def build(self, user_id: str, role: Optional[str] = None, company: Optional[str] = None, skill: Optional[str] = None) -> Dict[str, Any]:
        graph = await get_omnisave_evidence_store().context_graph(user_id, skill=skill, role=role)
        sources = graph.get("sources", [])
        highlights = graph.get("highlights", [])
        questions = graph.get("questions", [])
        context_links = graph.get("context_links", [])
        if company:
            company_filter = company.lower()
            sources = [source for source in sources if company_filter in str(source.get("title", "")).lower() or company_filter in str(source.get("category", "")).lower()]
            source_ids = {source.get("id") for source in sources}
            highlights = [item for item in highlights if item.get("source_id") in source_ids]
            questions = [item for item in questions if item.get("source_id") in source_ids]
            context_links = [item for item in context_links if item.get("source_id") in source_ids]
        evidence_coverage = len(highlights)
        def freshness_key(source: Dict[str, Any]) -> str:
            return str(source.get("last_seen_at") or source.get("created_at") or "")
        new_since_last_brief = sorted(sources, key=freshness_key, reverse=True)[:5]
        next_actions = []
        if not sources:
            next_actions.append("Capture or link one source to this role before preparing.")
        if sources and not highlights:
            next_actions.append("Open one source and save an exact passage as evidence.")
        if evidence_coverage and not questions:
            next_actions.append("Convert one evidence card into an interview question.")
        if questions:
            next_actions.append("Practice the highest-signal question aloud and connect it to a concrete example.")
        if not next_actions:
            next_actions.append("Review the evidence cards and rehearse the next question in your interview panel.")
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "filters": {"role": role, "company": company, "skill": skill},
            "headline": f"Your {role or 'career'} brief is ready",
            "summary": f"{len(sources)} sources, {len(highlights)} evidence cards, and {len(questions)} reusable interview questions are connected to this context.",
            "stats": {"sources": len(sources), "evidence_cards": evidence_coverage, "questions": len(questions), "context_links": len(context_links)},
            "next_actions": next_actions[:4],
            "sources": sources[:8],
            "new_since_last_brief": new_since_last_brief,
            "highlights": highlights[:8],
            "questions": questions[:8],
        }


_brief_service = OmniSaveBriefService()


def get_omnisave_brief_service() -> OmniSaveBriefService:
    return _brief_service
