"""Layered Memory Distillation Engine (L0 -> L3) for Tayari AI Engine.

Inspired by TencentDB Agent Memory model:
- L0: Raw session interactions and submitted applications.
- L1: Extracted atomic facts (Candidate -> HAS_SKILL -> Skill).
- L2: Active job search goal context (Target role, required skills).
- L3: Candidate persona model & interview preferences.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import networkx as nx

logger = logging.getLogger(__name__)


class LayeredMemoryEngine:
    """Manages L0-L3 memory distillation and persistence."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.graph = nx.DiGraph()

    def add_l0_session(self, session_id: str, raw_text: str, source_type: str = "chat") -> Dict[str, Any]:
        """Record L0 raw session or application text."""
        l0_id = f"l0:{session_id}"
        self.graph.add_node(l0_id, type="l0_raw", text=raw_text, source=source_type)
        logger.info("Recorded L0 session: %s", l0_id)
        return {"l0_id": l0_id, "status": "recorded"}

    def distill_l1_facts(self, skills: List[str], companies: List[str], titles: List[str]) -> Dict[str, Any]:
        """Distill L0 raw data into L1 atomic facts in NetworkX graph."""
        l1_nodes = []
        user_node = f"user:{self.user_id}"
        self.graph.add_node(user_node, type="user_persona", user_id=self.user_id)

        for skill in skills:
            node_id = f"skill:{skill.lower()}"
            self.graph.add_node(node_id, type="skill", name=skill.lower())
            self.graph.add_edge(user_node, node_id, relationship="HAS_SKILL")
            l1_nodes.append(node_id)

        for company in companies:
            node_id = f"company:{company}"
            self.graph.add_node(node_id, type="company", name=company)
            self.graph.add_edge(user_node, node_id, relationship="WORKED_AT")
            l1_nodes.append(node_id)

        for title in titles:
            node_id = f"title:{title}"
            self.graph.add_node(node_id, type="title", name=title)
            self.graph.add_edge(user_node, node_id, relationship="HELD_ROLE")
            l1_nodes.append(node_id)

        return {"distilled_l1_count": len(l1_nodes), "user_id": self.user_id}

    def set_l2_context(self, target_role: str, desired_location: str, min_salary: Optional[int] = None) -> Dict[str, Any]:
        """Set L2 active job search goal context."""
        l2_node = f"l2_context:{self.user_id}"
        self.graph.add_node(
            l2_node,
            type="l2_goal",
            target_role=target_role,
            location=desired_location,
            min_salary=min_salary
        )
        user_node = f"user:{self.user_id}"
        self.graph.add_edge(user_node, l2_node, relationship="CURRENT_GOAL")
        return {"l2_node": l2_node, "target_role": target_role}

    def get_l3_persona(self) -> Dict[str, Any]:
        """Retrieve L3 candidate persona model."""
        user_node = f"user:{self.user_id}"
        skills = [n.replace("skill:", "") for n in self.graph.neighbors(user_node) if n.startswith("skill:")]
        companies = [n.replace("company:", "") for n in self.graph.neighbors(user_node) if n.startswith("company:")]
        titles = [n.replace("title:", "") for n in self.graph.neighbors(user_node) if n.startswith("title:")]

        l2_node = f"l2_context:{self.user_id}"
        goal_data = self.graph.nodes.get(l2_node, {})

        return {
            "user_id": self.user_id,
            "skills": skills,
            "companies": companies,
            "titles": titles,
            "target_role": goal_data.get("target_role", "Software Engineer"),
            "location_preference": goal_data.get("location", "Remote / Any"),
            "graph_summary": {
                "total_nodes": self.graph.number_of_nodes(),
                "total_edges": self.graph.number_of_edges()
            }
        }
