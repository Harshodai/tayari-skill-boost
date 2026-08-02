import os
import uuid
from typing import Dict, Any, List, Optional

STAGES = [
    "APPLIED",
    "SCREENING",
    "TECHNICAL_INTERVIEW",
    "BEHAVIORAL_SYSTEM_DESIGN",
    "OFFER_STAGE",
    "ACCEPTED"
]

class InterviewBoardEngine:
    """
    Interview Board Engine (Kanban & Prep Center).
    Tracks candidate applications by stage (Applied, Screening, Technical, System Design, Offer),
    links Email Connector interview invites, company prep briefs, and live copilot sessions.
    """

    def __init__(self, enable_demo_cards: bool = False):
        self.board_cards: List[Dict[str, Any]] = []

        is_demo = enable_demo_cards or os.getenv("ENABLE_DEMO_CARDS", "false").lower() == "true"
        if is_demo:
            self.board_cards = [
                {
                    "card_id": "CARD-001",
                    "company": "Stripe",
                    "role": "Senior Systems Architect",
                    "stage": "TECHNICAL_INTERVIEW",
                    "interview_date": "Aug 6, 2026 - 2:00 PM PST",
                    "meeting_link": "https://meet.google.com/abc-xyz-123",
                    "prep_brief": {
                        "tech_stack": ["Go", "Ruby", "Kubernetes", "PostgreSQL"],
                        "key_talking_points": ["Highlight high-throughput API gateway experience", "Emphasize zero-downtime database migrations"]
                    },
                    "email_synced": True
                },
                {
                    "card_id": "CARD-002",
                    "company": "Anthropic",
                    "role": "Lead Infrastructure Architect",
                    "stage": "BEHAVIORAL_SYSTEM_DESIGN",
                    "interview_date": "Aug 7, 2026 - 10:00 AM PST",
                    "meeting_link": "https://meet.google.com/ant-sys-456",
                    "prep_brief": {
                        "tech_stack": ["Python", "Rust", "Ray", "Distributed Systems"],
                        "key_talking_points": ["Discuss LLM agent orchestration harnesses", "Mention MCP protocol implementations"]
                    },
                    "email_synced": True
                },
                {
                    "card_id": "CARD-003",
                    "company": "ScaleUp Systems",
                    "role": "Backend Engineer",
                    "stage": "SCREENING",
                    "interview_date": "Aug 10, 2026 - 11:00 AM PST",
                    "meeting_link": "Pending Link",
                    "prep_brief": {
                        "tech_stack": ["Python", "FastAPI", "Docker"],
                        "key_talking_points": ["Focus on API performance tuning"]
                    },
                    "email_synced": True
                },
                {
                    "card_id": "CARD-004",
                    "company": "TechCorp Innovations",
                    "role": "Principal Systems Engineer",
                    "stage": "OFFER_STAGE",
                    "interview_date": "Completed",
                    "meeting_link": "N/A",
                    "prep_brief": {
                        "tech_stack": ["Go", "Kubernetes"],
                        "key_talking_points": ["Negotiating initial compensation offer"]
                    },
                    "email_synced": True
                }
            ]

    def get_kanban_board(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Group interview cards into Kanban board columns.
        """
        columns: Dict[str, List[Dict[str, Any]]] = {stage: [] for stage in STAGES}

        for card in self.board_cards:
            stage = card.get("stage", "APPLIED")
            if stage in columns:
                columns[stage].append(card)
            else:
                columns["APPLIED"].append(card)

        return columns

    def update_card_stage(self, card_id: str, new_stage: str) -> Dict[str, Any]:
        """Move card to new pipeline stage."""
        if new_stage not in STAGES:
            return {"success": False, "error": f"Invalid stage '{new_stage}'. Must be one of {STAGES}."}

        for card in self.board_cards:
            if card["card_id"] == card_id:
                card["stage"] = new_stage
                return {"success": True, "card": card}
        return {"success": False, "error": f"Card '{card_id}' not found."}

    def add_interview_card(self, company: str, role: str, stage: str = "SCREENING", interview_date: str = "TBD") -> Dict[str, Any]:
        """Add new interview card to board."""
        if stage not in STAGES:
            stage = "SCREENING"

        card_id = f"CARD-{uuid.uuid4().hex[:8]}"
        new_card = {
            "card_id": card_id,
            "company": company,
            "role": role,
            "stage": stage,
            "interview_date": interview_date,
            "meeting_link": "TBD",
            "prep_brief": {"key_talking_points": ["Prepare system design notes"]},
            "email_synced": True
        }
        self.board_cards.append(new_card)
        return {"success": True, "card": new_card}
