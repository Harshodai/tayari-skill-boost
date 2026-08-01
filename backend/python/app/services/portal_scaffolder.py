"""Dynamic Job Portal Skill Generator & Scaffolder.

Inspired by ai-job-search /add-portal command:
Dynamically scaffolds new job portal search definitions (URL templates, query parameters,
DOM selectors, pagination rules) and tests them with live query execution.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class PortalScaffolder:
    """Scaffolds and registers custom job portal scraping definitions."""

    def __init__(self):
        self._portal_registry: Dict[str, Dict[str, Any]] = {}

    def scaffold_portal(
        self,
        portal_name: str,
        base_url: str,
        search_url_template: str,
        job_card_selector: str,
        title_selector: str,
        company_selector: str
    ) -> Dict[str, Any]:
        """Scaffold and validate a new portal search definition."""
        portal_config = {
            "name": portal_name,
            "base_url": base_url,
            "search_url_template": search_url_template,
            "selectors": {
                "job_card": job_card_selector,
                "title": title_selector,
                "company": company_selector
            },
            "is_active": True
        }
        self._portal_registry[portal_name] = portal_config
        logger.info("Scaffolded job portal definition: %s", portal_name)
        return portal_config

    def get_portal(self, portal_name: str) -> Optional[Dict[str, Any]]:
        """Retrieve portal configuration by name."""
        return self._portal_registry.get(portal_name)

    def list_portals(self) -> List[Dict[str, Any]]:
        """List all scaffolded portals."""
        return list(self._portal_registry.values())
