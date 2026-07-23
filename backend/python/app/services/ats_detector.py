"""
ATS Target Signature Detector Service.
Detects underlying ATS vendor from job posting URLs or page contents (Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Taleo, iCIMS)
and provides vendor-specific formatting rules for resume tailoring.
"""
from __future__ import annotations
import re
from typing import Dict, Any
from pydantic import BaseModel, Field


class ATSRules(BaseModel):
    vendor: str = Field(description="Detected ATS vendor name")
    displayName: str = Field(description="Human readable ATS name")
    max_pages: int = Field(default=1, description="Recommended max page count")
    single_column_required: bool = Field(default=True, description="Strict single column layout required")
    avoid_tables: bool = Field(default=True, description="Avoid complex tables")
    avoid_graphics: bool = Field(default=True, description="Avoid header icons / graphic elements")
    header_style: str = Field(default="ALL_CAPS", description="Recommended section header formatting style")
    bullet_symbol: str = Field(default="•", description="Safe bullet point symbol")
    parsing_notes: str = Field(default="", description="Specific notes for passing this ATS scanner")


ATS_RULE_PRESETS: Dict[str, ATSRules] = {
    "workday": ATSRules(
        vendor="workday",
        displayName="Workday ATS",
        max_pages=2,
        single_column_required=True,
        avoid_tables=True,
        avoid_graphics=True,
        header_style="ALL_CAPS",
        bullet_symbol="•",
        parsing_notes="Workday strips multi-column layouts and textboxes into unstructured text blocks. Use standard section headers: WORK EXPERIENCE, EDUCATION, SKILLS."
    ),
    "greenhouse": ATSRules(
        vendor="greenhouse",
        displayName="Greenhouse",
        max_pages=2,
        single_column_required=False,
        avoid_tables=True,
        avoid_graphics=True,
        header_style="Title Case",
        bullet_symbol="•",
        parsing_notes="Greenhouse parses standard PDF/Word text cleanly. Strong support for markdown text formatting and bold achievement metrics."
    ),
    "lever": ATSRules(
        vendor="lever",
        displayName="Lever",
        max_pages=2,
        single_column_required=False,
        avoid_tables=True,
        avoid_graphics=True,
        header_style="Title Case",
        bullet_symbol="-",
        parsing_notes="Lever extracts clean experience timelines. Ensure explicit Start Date - End Date formatting (MM/YYYY - MM/YYYY)."
    ),
    "ashby": ATSRules(
        vendor="ashby",
        displayName="Ashby",
        max_pages=2,
        single_column_required=False,
        avoid_tables=False,
        avoid_graphics=True,
        header_style="Clean Header",
        bullet_symbol="•",
        parsing_notes="Modern ATS parser with strong LLM extraction. Parses raw skills, github links, and portfolio links seamlessly."
    ),
    "taleo": ATSRules(
        vendor="taleo",
        displayName="Oracle Taleo",
        max_pages=1,
        single_column_required=True,
        avoid_tables=True,
        avoid_graphics=True,
        header_style="ALL_CAPS",
        bullet_symbol="•",
        parsing_notes="Legacy enterprise parser. Extremely strict keyword matching and single-column text requirements. Avoid any non-standard symbols."
    ),
    "icims": ATSRules(
        vendor="icims",
        displayName="iCIMS",
        max_pages=2,
        single_column_required=True,
        avoid_tables=True,
        avoid_graphics=True,
        header_style="ALL_CAPS",
        bullet_symbol="•",
        parsing_notes="iCIMS parses clean standard resumes. Highly weights exact skill match frequency and location match."
    ),
    "generic": ATSRules(
        vendor="generic",
        displayName="Standard ATS Engine",
        max_pages=1,
        single_column_required=True,
        avoid_tables=True,
        avoid_graphics=True,
        header_style="ALL_CAPS",
        bullet_symbol="•",
        parsing_notes="Universal ATS-compliant rules applied."
    )
}


def detect_ats_from_url(url: str, html_snippet: str = "") -> ATSRules:
    """
    Detect ATS vendor based on job post URL domain or page HTML patterns.
    """
    url_lower = url.lower()
    html_lower = html_snippet.lower()

    if "myworkdayjobs.com" in url_lower or "workday" in url_lower or "workday" in html_lower:
        return ATS_RULE_PRESETS["workday"]

    if "greenhouse.io" in url_lower or "greenhouse" in url_lower or "gh_src" in url_lower or "greenhouse" in html_lower:
        return ATS_RULE_PRESETS["greenhouse"]

    if "lever.co" in url_lower or "lever" in url_lower or "lever" in html_lower:
        return ATS_RULE_PRESETS["lever"]

    if "ashbyhq.com" in url_lower or "ashby" in url_lower or "ashby" in html_lower:
        return ATS_RULE_PRESETS["ashby"]

    if "taleo.net" in url_lower or "taleo" in url_lower or "taleo" in html_lower:
        return ATS_RULE_PRESETS["taleo"]

    if "icims.com" in url_lower or "icims" in url_lower or "icims" in html_lower:
        return ATS_RULE_PRESETS["icims"]

    return ATS_RULE_PRESETS["generic"]
