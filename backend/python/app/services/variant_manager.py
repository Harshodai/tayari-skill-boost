"""Multi-Target Profile Variant Switcher — Tayari AI Engine.

Allows jobseekers to maintain and switch between 3 specialized target profile variants:
- Full Stack Engineer
- Backend / Systems Architect
- AI / Machine Learning Applications Engineer
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

PROFILE_VARIANTS = {
    "full_stack": {
        "variant_id": "full_stack",
        "title": "Full Stack Engineer",
        "primary_skills": ["React", "TypeScript", "Go", "Python", "PostgreSQL", "Tailwind CSS"],
        "headline_focus": "Building end-to-end scalable web applications, responsive UIs, and robust backend microservices.",
    },
    "backend_architect": {
        "variant_id": "backend_architect",
        "title": "Backend / Systems Architect",
        "primary_skills": ["Go", "Python", "Kubernetes", "Kafka", "Redis", "Docker", "System Design"],
        "headline_focus": "Architecting high-concurrency microservices, event-driven streaming pipelines, and distributed data systems.",
    },
    "ai_engineer": {
        "variant_id": "ai_engineer",
        "title": "AI & LLM Applications Engineer",
        "primary_skills": ["Python", "PyTorch", "LangChain", "browser-use", "Ollama", "pgvector", "FastAPI"],
        "headline_focus": "Engineering autonomous AI agents, multi-modal inference pipelines, and production RAG architecture.",
    },
}


def get_profile_variants() -> Dict[str, Any]:
    """Return configured target profile variants."""
    return {
        "active_variant": "backend_architect",
        "variants": list(PROFILE_VARIANTS.values()),
    }
