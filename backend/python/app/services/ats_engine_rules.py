from __future__ import annotations
"""Per-ATS-engine formatting rules as data + pure diagnose function. No LLM."""
import re

SUPPORTED_ENGINES = ("greenhouse", "workday", "taleo", "lever")

RULE_SETS: dict[str, list[dict]] = {
    "greenhouse": [
        {"rule": "gh_standard_headers", "description": "Standard section headers present"},
        {"rule": "gh_simple_bullets", "description": "Simple bullets only (-, *, •)"},
        {"rule": "gh_no_tables", "description": "No tables or pipes"},
        {"rule": "gh_contact_present", "description": "Contact email present"},
    ],
    "workday": [
        {"rule": "wd_no_tables", "description": "No tables, pipes, or box borders"},
        {"rule": "wd_no_text_boxes", "description": "No text boxes or box-drawing chars"},
        {"rule": "wd_no_header_footer", "description": "No headers/footers or page numbers"},
        {"rule": "wd_date_format", "description": "Standard date formats"},
    ],
    "taleo": [
        {"rule": "tl_no_graphics", "description": "No graphics or image placeholders"},
        {"rule": "tl_standard_headers", "description": "Standard section headers present"},
        {"rule": "tl_simple_bullets", "description": "Simple bullets only"},
        {"rule": "tl_no_columns", "description": "No table/column markers"},
    ],
    "lever": [
        {"rule": "lv_simple_bullets", "description": "Simple bullets only"},
        {"rule": "lv_no_tables", "description": "No tables or pipes"},
        {"rule": "lv_contact_present", "description": "Contact email present"},
        {"rule": "lv_reasonable_length", "description": "Reasonable length (50-2000 words)"},
    ],
}

_FANCY_BULLETS = ("➢", "◆", "►", "▸", "▪", "■", "○", "●", "→", "⇒")
_BOX_CHARS = ("┌", "┐", "└", "┘", "│", "─", "━", "┃", "┏", "┓")
_GRAPHIC_MARKERS = ("[image", "<img", "█", "▓", "(graphic)")
_TABLE_RE = re.compile(r"\||\+-{3,}|\t")
_PAGE_RE = re.compile(r"page\s+\d+\s+of\s+\d+", re.IGNORECASE)
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_HEADER_RE = re.compile(r"(experience|education|skills)", re.IGNORECASE)
_DATE_RE = re.compile(
    r"(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}|\d{1,2}/\d{4}|\d{4}-\d{2}|(?:19|20)\d{2})",
    re.IGNORECASE,
)


def _has_fancy_bullets(text: str) -> bool:
    return any(c in text for c in _FANCY_BULLETS)


def _check(rule: str, text: str) -> tuple[bool, str]:
    if rule in ("gh_standard_headers", "tl_standard_headers"):
        ok = bool(_HEADER_RE.search(text))
        return ok, "standard headers found" if ok else "missing standard headers (experience/education/skills)"
    if rule in ("gh_simple_bullets", "tl_simple_bullets", "lv_simple_bullets"):
        ok = not _has_fancy_bullets(text)
        return ok, "bullets are simple" if ok else "fancy bullet characters detected"
    if rule in ("gh_no_tables", "wd_no_tables", "tl_no_columns", "lv_no_tables"):
        ok = not bool(_TABLE_RE.search(text))
        return ok, "no table markers" if ok else "table markers (|, +---, tab) detected"
    if rule in ("gh_contact_present", "lv_contact_present"):
        ok = bool(_EMAIL_RE.search(text))
        return ok, "contact email found" if ok else "missing contact email"
    if rule == "wd_no_text_boxes":
        low = text.lower()
        ok = not (any(c in text for c in _BOX_CHARS) or "text box" in low or "[textbox" in low)
        return ok, "no text boxes" if ok else "text-box or box-drawing characters detected"
    if rule == "wd_no_header_footer":
        ok = not bool(_PAGE_RE.search(text))
        return ok, "no header/footer page markers" if ok else "page header/footer marker detected"
    if rule == "wd_date_format":
        dates = _DATE_RE.findall(text)
        has_year = bool(re.search(r"(19|20)\d{2}", text))
        ok = bool(dates) and has_year
        return ok, "dates use standard format" if ok else "no standard-format dates found"
    if rule == "tl_no_graphics":
        low = text.lower()
        ok = not any(m in low for m in _GRAPHIC_MARKERS)
        return ok, "no graphics detected" if ok else "graphic/image placeholder detected"
    if rule == "lv_reasonable_length":
        n = len(text.split())
        ok = 50 <= n <= 2000
        return ok, f"{n} words" if ok else f"{n} words outside 50-2000 range"
    return True, "unknown rule passes"


def diagnose_formatting(resume_text: str, engine: str) -> list[dict]:
    key = (engine or "").strip().lower()
    if key not in RULE_SETS:
        raise ValueError(f"unsupported ATS engine: {engine}")
    text = resume_text or ""
    out = []
    for r in RULE_SETS[key]:
        passed, detail = _check(r["rule"], text)
        out.append({"rule": r["rule"], "passed": passed, "detail": detail})
    return out
