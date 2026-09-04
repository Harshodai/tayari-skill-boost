from __future__ import annotations
"""Independent deterministic critic for optimizer drafts.

Reimplemented from scratch; shares no code with optimizer's alignment check.
Zero LLM calls.

dropped_employers semantics (advisory only): lists master-profile employers
absent from the draft. Dropping an employer is NOT a fabrication signal and
never flips verdict to fail on its own — it is reported in
``dropped_employers`` + ``reasons`` as tailoring context (e.g. condensing to
one page). Only invented metrics/years/employers/degrees fail the verdict.
"""
import re


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower().rstrip(".,;:")


_METRIC_RE = re.compile(r"\$?\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|[kKmM]\+?|[bB]\+?)?")
_YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
_DEGREE_RE = re.compile(
    r"\b(?:B\.?\s*S\.?|M\.?\s*S\.?|MBA|Ph\.?\s*D\.?|B\.?\s*Tech|M\.?\s*Tech|"
    r"Bachelor(?:'s)?|Master(?:'s)?|Associate(?:'s)?)\b[^.\n,;]{0,40}",
    re.IGNORECASE,
)
_EMPLOYER_CUE_RE = re.compile(
    r"(?:\bat\s+|\bwith\s+|\bfor\s+|\b@\s*|employer\s*:\s*)"
    r"([A-Z][A-Za-z0-9&.\-]*(?:\s+[A-Z][A-Za-z0-9&.\-]*){0,3})"
)
_EMPLOYER_SUFFIX_RE = re.compile(
    r"\b([A-Z][A-Za-z0-9&.\-]*(?:\s+[A-Z][A-Za-z0-9&.\-]*){0,3}\s+"
    r"(?:Inc\.?|LLC|Corp\.?|Corporation|Labs|Technologies|Systems|Solutions|"
    r"Software|Consulting|Group|Partners|Industries))\b"
)


def _extract_metrics(text: str) -> list[str]:
    out = []
    for m in _METRIC_RE.finditer(text or ""):
        raw = m.group(0)
        digits = re.sub(r"\D", "", raw)
        if not digits:
            continue
        has_sigil = any(c in raw for c in "%$kKmMbB+")
        if not has_sigil:
            if len(digits) == 4 and digits.startswith(("19", "20")):
                continue
            if len(digits) < 2:
                continue
        out.append(_norm(raw).replace(" ", "").replace(",", ""))
    return out


def _extract_years(text: str) -> list[str]:
    return _YEAR_RE.findall(text or "")


def _extract_degrees(text: str) -> list[str]:
    return [_norm(m.group(0)) for m in _DEGREE_RE.finditer(text or "") if _norm(m.group(0))]


def _extract_employers(text: str) -> list[str]:
    found = []
    for rx in (_EMPLOYER_CUE_RE, _EMPLOYER_SUFFIX_RE):
        for m in rx.finditer(text or ""):
            name = _norm(m.group(1))
            if name and len(name) >= 2:
                found.append(name)
    seen, out = set(), []
    for name in found:
        if name not in seen:
            seen.add(name)
            out.append(name)
    return out


def _employer_words(names: list[str]) -> set[str]:
    words = set()
    for n in names:
        words.update(w for w in re.findall(r"[a-z0-9]+", n) if len(w) >= 3)
    return words


def audit_draft(
    draft_text: str, master_profile_text: str, job_description: str = ""
) -> dict:
    _ = job_description
    draft, master = draft_text or "", master_profile_text or ""
    reasons: list[str] = []
    if not draft.strip():
        return {
            "verdict": "fail",
            "grounding_ratio": 0.0,
            "invented_metrics": [],
            "dropped_employers": sorted(_extract_employers(master)),
            "reasons": ["empty draft: no content to verify"],
        }

    master_metrics = set(_extract_metrics(master))
    master_years = set(_extract_years(master))
    master_degrees = _extract_degrees(master)
    master_degree_text = _norm(master)
    master_employers = _extract_employers(master)
    master_employer_set = set(master_employers)
    master_emp_words = _employer_words(master_employers)

    draft_metrics = _extract_metrics(draft)
    draft_years = _extract_years(draft)
    draft_degrees = _extract_degrees(draft)
    draft_employers = _extract_employers(draft)

    invented_metrics = sorted({m for m in draft_metrics if m not in master_metrics})
    invented_years = sorted({y for y in draft_years if y not in master_years})

    invented_degrees = sorted({
        d for d in draft_degrees
        if d not in set(master_degrees)
        and not (
            re.findall(r"[a-z]+", d)
            and all(w in master_degree_text for w in re.findall(r"[a-z]+", d) if len(w) >= 2)
        )
    })

    invented_employers = sorted([
        e for e in set(draft_employers)
        if e not in master_employer_set
        and not (set(re.findall(r"[a-z0-9]+", e)) & master_employer_set)
        and not (_employer_words([e]) & master_emp_words)
    ])
    dropped_employers = sorted([e for e in master_employer_set if e not in set(draft_employers)])

    matched = (
        sum(1 for m in draft_metrics if m in master_metrics)
        + sum(1 for y in draft_years if y in master_years)
        + sum(1 for e in draft_employers if e not in invented_employers)
        + sum(1 for d in draft_degrees if d not in invented_degrees)
    )
    total = len(draft_metrics) + len(draft_years) + len(draft_employers) + len(draft_degrees)
    ratio = round(matched / total, 3) if total else 1.0

    for m in invented_metrics:
        reasons.append(f"invented metric '{m}' not found in master profile")
    for y in invented_years:
        reasons.append(f"invented year '{y}' not found in master profile")
    for e in invented_employers:
        reasons.append(f"invented employer '{e}' not found in master profile")
    for d in invented_degrees:
        reasons.append(f"invented degree '{d}' not found in master profile")
    for e in dropped_employers:
        reasons.append(f"dropped employer '{e}' present in master but missing from draft")

    verdict = (
        "fail"
        if (invented_metrics or invented_years or invented_employers or invented_degrees)
        else "pass"
    )
    return {
        "verdict": verdict,
        "grounding_ratio": ratio,
        "invented_metrics": invented_metrics + invented_years,
        "dropped_employers": dropped_employers,
        "reasons": reasons,
    }
