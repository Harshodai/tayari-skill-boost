"""Custom Resume & Cover Letter Template Registry.

Inspired by ai-job-search /add-template command:
Registers and manages custom user resume templates (Typst, LaTeX, Markdown), engine rules,
font requirements, and validation bounds.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class TemplateRegistry:
    """Manages custom resume & cover letter templates."""

    def __init__(self):
        self._templates: Dict[str, Dict[str, Any]] = {}
        self._register_default_templates()

    def _register_default_templates(self):
        """Register default stock templates."""
        self.register_template(
            template_id="modern_latex_cv",
            name="Modern LaTeX CV",
            engine="latex",
            compile_command="lualatex",
            file_extension=".tex",
            template_content="\\documentclass{article}\n\\begin{document}\n\\section{Experience}\n\\end{document}"
        )
        self.register_template(
            template_id="clean_typst_cv",
            name="Clean Typst Resume",
            engine="typst",
            compile_command="typst compile",
            file_extension=".typ",
            template_content="#set page(paper: \"a4\")\n= Resume"
        )

    def register_template(
        self,
        template_id: str,
        name: str,
        engine: str,
        compile_command: str,
        file_extension: str,
        template_content: str,
        font_rules: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Register a new template configuration."""
        entry = {
            "template_id": template_id,
            "name": name,
            "engine": engine,
            "compile_command": compile_command,
            "file_extension": file_extension,
            "template_content": template_content,
            "font_rules": font_rules or ["Roboto", "Lato"],
            "is_active": True
        }
        self._templates[template_id] = entry
        logger.info("Registered template: %s (%s)", name, engine)
        return entry

    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve template configuration by ID."""
        return self._templates.get(template_id)

    def list_templates(self) -> List[Dict[str, Any]]:
        """List all registered templates."""
        return list(self._templates.values())
