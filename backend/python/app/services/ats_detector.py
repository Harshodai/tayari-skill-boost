"""ATS Fingerprinting and Detection Engine — Tayari AI Engine.

Identifies the specific ATS platform (Workday, Greenhouse, Lever, Ashby, Taleo, iCIMS, SmartRecruiters, BambooHR)
from job URLs or page DOM HTML, returning parser rules, formatting quirks, and scoring constraints.
"""

from __future__ import annotations

import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Pattern signatures for popular ATS platforms
ATS_SIGNATURES = {
    "greenhouse": [
        r"boards\.greenhouse\.io",
        r"greenhouse\.io",
        r"gh_jid",
        r"grnh\.se",
    ],
    "lever": [
        r"jobs\.lever\.co",
        r"lever\.co",
        r"lever-job-title",
    ],
    "workday": [
        r"myworkdayjobs\.com",
        r"workday\.com",
        r"wd3\.myworkday",
        r"wd5\.myworkday",
        r"workday-app",
    ],
    "ashby": [
        r"jobs\.ashbyhq\.com",
        r"ashbyhq\.com",
        r"ashby_embed",
    ],
    "taleo": [
        r"taleo\.net",
        r"oraclecloud\.com/hcm",
        r"taleo-job",
    ],
    "icims": [
        r"icims\.com",
        r"jobs-icims",
        r"icims_portal",
    ],
    "smartrecruiters": [
        r"smartrecruiters\.com",
        r"jobs\.smartrecruiters",
    ],
    "bamboohr": [
        r"bamboohr\.com/careers",
        r"bamboohr\.com/jobs",
    ]
}

ATS_PARSER_RULES = {
    "workday": {
        "name": "Workday Recruiting",
        "strictness": "High",
        "parsing_type": "Plain Text Block Extractor",
        "column_support": False,
        "table_support": False,
        "recommended_font": "Arial / Liberation Sans",
        "font_size_pt": 10,
        "bullet_style": "Standard dash (-)",
        "header_footer_parsed": False,
        "preferred_format": "PDF / DOCX",
        "tips": [
            "Avoid two-column layouts; Workday merges left and right columns horizontally.",
            "Use standard section headers ('Work Experience', 'Education', 'Skills').",
            "Avoid graphic elements, text boxes, or embedded images."
        ]
    },
    "greenhouse": {
        "name": "Greenhouse Software",
        "strictness": "Medium",
        "parsing_type": "PDF Structured Parser",
        "column_support": True,
        "table_support": True,
        "recommended_font": "Liberation Sans / Helvetica",
        "font_size_pt": 9.5,
        "bullet_style": "Standard bullet (•)",
        "header_footer_parsed": True,
        "preferred_format": "PDF",
        "tips": [
            "Supports clean 2-column layouts if bounding boxes are distinct.",
            "Parses LinkedIn URLs and email addresses reliably from top header.",
            "Keywords in bullet points are weighted heavily in candidate match scoring."
        ]
    },
    "lever": {
        "name": "Lever Hire",
        "strictness": "Medium",
        "parsing_type": "Full Document Text Extractor",
        "column_support": True,
        "table_support": False,
        "recommended_font": "DejaVu Sans / Inter",
        "font_size_pt": 10,
        "bullet_style": "Standard bullet (•)",
        "header_footer_parsed": True,
        "preferred_format": "PDF",
        "tips": [
            "Lever parses company names and job titles first.",
            "Keep date ranges in standard format (e.g., 'Jan 2022 - Present').",
            "Lever highlights exact tech stack matches directly in the recruiter UI."
        ]
    },
    "ashby": {
        "name": "Ashby HQ",
        "strictness": "Low (Modern LLM-Powered)",
        "parsing_type": "Semantic LLM Parser",
        "column_support": True,
        "table_support": True,
        "recommended_font": "Modern Clean Sans",
        "font_size_pt": 9.5,
        "bullet_style": "Any standard bullet",
        "header_footer_parsed": True,
        "preferred_format": "PDF",
        "tips": [
            "Ashby uses modern AI parsing — highly flexible with columns and formatting.",
            "Quantified achievements (% metrics, revenue numbers) rank highest in Ashby search.",
            "Custom skills lists are auto-categorized into tech stack buckets."
        ]
    },
    "generic": {
        "name": "Standard ATS Parser",
        "strictness": "Medium",
        "parsing_type": "Standard Text Extraction",
        "column_support": False,
        "table_support": False,
        "recommended_font": "Liberation Sans",
        "font_size_pt": 10,
        "bullet_style": "Standard bullet (•)",
        "header_footer_parsed": False,
        "preferred_format": "PDF",
        "tips": [
            "Use clear single-column structure for maximum compatibility.",
            "Ensure email, phone, and location are in clear body text.",
            "Include explicit tech skills section."
        ]
    }
}


class ATSDetector:
    """Detects ATS platform signatures and supplies targeted optimization rules."""

    @staticmethod
    def detect(url: str = "", html_content: str = "") -> Dict[str, Any]:
        """Detect ATS from URL or page HTML snippet."""
        target_ats = "generic"
        matched_pattern = ""

        # Check URL
        if url:
            for ats_key, patterns in ATS_SIGNATURES.items():
                for pattern in patterns:
                    if re.search(pattern, url, re.IGNORECASE):
                        target_ats = ats_key
                        matched_pattern = pattern
                        break
                if target_ats != "generic":
                    break

        # Check HTML content if URL match not found
        if target_ats == "generic" and html_content:
            for ats_key, patterns in ATS_SIGNATURES.items():
                for pattern in patterns:
                    if re.search(pattern, html_content, re.IGNORECASE):
                        target_ats = ats_key
                        matched_pattern = pattern
                        break
                if target_ats != "generic":
                    break

        rules = ATS_PARSER_RULES.get(target_ats, ATS_PARSER_RULES["generic"])

        logger.info(f"[ATSDetector] Detected ATS '{target_ats}' (matched: '{matched_pattern}') for URL: {url}")

        return {
            "ats_key": target_ats,
            "ats_name": rules["name"],
            "matched_pattern": matched_pattern,
            "rules": rules,
        }
