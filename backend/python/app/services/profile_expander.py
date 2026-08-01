"""Profile Auto-Expansion & Competency Discovery Service.

Inspired by ai-job-search /expand command:
Scans public developer sources (GitHub user/repos, portfolio sites) and extracts
implicit technical competencies, languages, frameworks, and project metrics to enrich
the candidate's Knowledge Graph.
"""

from __future__ import annotations

import logging

import re
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)


class ProfileExpander:
    """Enriches candidate profile by scanning public developer profiles and repositories."""

    @staticmethod
    async def expand_from_github(github_username: str) -> Dict[str, Any]:
        """Fetch public repositories for a GitHub user and discover technical skills."""
        if not github_username:
            return {"status": "error", "message": "GitHub username is required"}

        url = f"https://api.github.com/users/{github_username}/repos?per_page=30&sort=updated"
        discovered_languages: set[str] = set()
        discovered_topics: set[str] = set()
        discovered_projects: List[Dict[str, str]] = []

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers={"User-Agent": "TayariSkillBoost/1.0"})
                if response.status_code == 200:
                    repos = response.json()
                    for repo in repos:
                        if isinstance(repo, dict):
                            lang = repo.get("language")
                            if lang:
                                discovered_languages.add(lang.lower())

                            topics = repo.get("topics") or []
                            for topic in topics:
                                discovered_topics.add(str(topic).lower())

                            discovered_projects.append({
                                "name": repo.get("name", ""),
                                "description": repo.get("description", "") or "",
                                "language": lang or "N/A",
                                "stars": str(repo.get("stargazers_count", 0)),
                                "url": repo.get("html_url", "")
                            })
                else:
                    logger.warning("GitHub API returned status code %d for %s", response.status_code, github_username)

        except Exception as exc:
            logger.error("Failed to expand GitHub profile for %s: %s", github_username, exc)

        all_skills = sorted(list(discovered_languages | discovered_topics))

        return {
            "status": "success",
            "github_username": github_username,
            "discovered_skills": all_skills,
            "discovered_languages": sorted(list(discovered_languages)),
            "discovered_topics": sorted(list(discovered_topics)),
            "discovered_projects": discovered_projects[:10],
            "total_repos_analyzed": len(discovered_projects)
        }
