"""
Lightweight entity extraction using pattern matching and curated lists.
No heavy transformers required.
"""
import json
import os
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple

from app.schemas import EntitiesResponse


_CURATED_DIR = Path(__file__).parent.parent / "data"


class EntityExtractor:
    """Extract skills, tools, and certifications from text."""

    def __init__(self):
        self.skills: Set[str] = set()
        self.tools: Set[str] = set()
        self.certifications: Set[str] = set()
        self._load_data()

    def _load_data(self):
        skills_file = _CURATED_DIR / "skills.json"
        tools_file = _CURATED_DIR / "tools.json"
        certs_file = _CURATED_DIR / "certifications.json"

        if skills_file.exists():
            self.skills = set(json.loads(skills_file.read_text()))
        if tools_file.exists():
            self.tools = set(json.loads(tools_file.read_text()))
        if certs_file.exists():
            self.certifications = set(json.loads(certs_file.read_text()))

    def extract(self, text: str) -> EntitiesResponse:
        text_lower = text.lower()
        found_skills = {s for s in self.skills if s.lower() in text_lower}
        found_tools = {t for t in self.tools if t.lower() in text_lower}
        found_certs = {c for c in self.certifications if c.lower() in text_lower}

        # Fallback: simple keyword matching for common tech terms
        found_skills.update(self._fallback_skills(text_lower))

        return EntitiesResponse(
            skills=sorted(found_skills),
            tools=sorted(found_tools),
            certifications=sorted(found_certs),
        )

    @staticmethod
    def _fallback_skills(text: str) -> Set[str]:
        common_tech = {
            "python", "javascript", "typescript", "java", "go", "golang", "rust",
            "c++", "c#", "kotlin", "swift", "ruby", "php", "scala", "perl", "r",
            "react", "angular", "vue", "svelte", "next.js", "nuxt", "django", "flask",
            "fastapi", "spring", "express", "rails", "laravel",
            "node.js", "nodejs", "deno", "bun",
            "docker", "kubernetes", "terraform", "ansible", "jenkins", "github actions",
            "aws", "azure", "gcp", "google cloud", "alibaba cloud", "digitalocean",
            "mysql", "postgresql", "postgres", "mongodb", "redis", "elasticsearch",
            "cassandra", "dynamodb", "firebase", "supabase",
            "graphql", "rest", "grpc", "soap", "websockets",
            "machine learning", "deep learning", "nlp", "data science",
            "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras",
            "git", "github", "gitlab", "bitbucket",
            "linux", "bash", "shell", "powershell",
            "ci/cd", "devops", "agile", "scrum", "kanban",
            "microservices", "soa", "event-driven", "serverless",
            "oauth", "jwt", "ssl", "tls",
            "html", "css", "sass", "less", "tailwind", "bootstrap",
            "jira", "confluence", "notion", "slack",
            "figma", "sketch", "adobe xd",
            "unity", "unreal engine",
            "blockchain", "solidity", "smart contracts", "ethereum",
            "flutter", "react native", "ios", "android",
        }
        return {tech for tech in common_tech if tech in text}


class KeywordInjector:
    """Suggest keyword injection points in resume bullet points."""

    @staticmethod
    def suggest_injections(
        experience_bullets: List[str],
        missing_keywords: List[str],
    ) -> List[Dict]:
        suggestions = []
        for idx, bullet in enumerate(experience_bullets):
            for kw in missing_keywords:
                kw_lower = kw.lower()
                if kw_lower in bullet.lower():
                    continue
                # Simple heuristic: if keyword is a technical term, insert it naturally
                modified = KeywordInjector._insert_keyword(bullet, kw)
                if modified != bullet:
                    suggestions.append({
                        "bullet_index": idx,
                        "original": bullet,
                        "suggestion": modified,
                        "inserted_keywords": [kw],
                        "preserves_voice": True,
                    })
        return suggestions

    @staticmethod
    def _insert_keyword(bullet: str, keyword: str) -> str:
        """Insert keyword into bullet while preserving voice."""
        # Try appending after verb or in tech stack list
        words = bullet.split()
        if not words:
            return bullet
        return f"{bullet.rstrip('.')}, leveraging {keyword}."
