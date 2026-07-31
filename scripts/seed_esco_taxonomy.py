#!/usr/bin/env python3
"""
ESCO Skill Taxonomy Seeder (Task 3.1)
======================================
Downloads a curated subset of ESCO v1.2 occupations/skills from the EU ESCO REST API
and merges them into skill_taxonomy.py's TAXONOMY dict.

Usage:
    python scripts/seed_esco_taxonomy.py [--dry-run] [--limit N]

Requirements: httpx (already in requirements.txt as transitive dep), or requests.

Output:
    - Prints new TAXONOMY entries to stdout (--dry-run mode).
    - Writes merged output to backend/python/app/services/skill_taxonomy_esco.py (full mode).
    - Does NOT overwrite skill_taxonomy.py \u2014 the operator merges manually after review.
"""
import argparse
import json
import sys
import time
import urllib.request
import urllib.parse

ESCO_BASE = "https://ec.europa.eu/esco/api"
DEFAULT_LIMIT = 100  # ESCO API page size max is 100

# Known stable ESCO concept type URIs
SKILLS_CONCEPT_URI = "http://data.europa.eu/esco/concept-scheme/skills"


class EscoRequestError(RuntimeError):
    """Raised when an ESCO API request fails (network error or bad JSON)."""


def esco_get(path: str, params: dict) -> dict:
    url = f"{ESCO_BASE}{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        # Propagate instead of returning {} — a swallowed failure looks
        # identical to a legitimate empty final page to fetch_skills below,
        # which would silently truncate the taxonomy instead of aborting.
        raise EscoRequestError(f"GET {url} failed: {e}") from e


def fetch_skills(limit: int = DEFAULT_LIMIT, language: str = "en") -> list[dict]:
    """Fetch ESCO skills using the /search endpoint.

    Raises EscoRequestError if any page request fails — callers must not
    treat a partial result as complete.
    """
    results = []
    offset = 0
    while len(results) < limit:
        page_size = min(100, limit - len(results))
        data = esco_get("/search", {
            "type": "skill",
            "language": language,
            "full": "true",
            "selectedVersion": "v1.2.0",
            "limit": page_size,
            "offset": offset,
        })
        hits = data.get("_embedded", {}).get("results", [])
        if not hits:
            break
        results.extend(hits)
        offset += len(hits)
        time.sleep(0.3)  # Be polite to ESCO API
    return results


def normalize_label(label: str) -> str:
    """Lowercase, strip trailing parens/qualifiers."""
    import re
    label = label.strip().lower()
    label = re.sub(r"\s*\(.*?\)", "", label).strip()
    return label


def build_taxonomy_entries(skills: list[dict]) -> dict:
    """
    Build {canonical: ([synonyms], [adjacent])} entries from ESCO API results.
    Synonyms come from altLabels; adjacent is empty (ESCO adjacency is a future M8 enhancement).
    """
    entries = {}
    for skill in skills:
        preferred = skill.get("title", "")
        if not preferred:
            continue
        canonical = normalize_label(preferred)
        alt_labels = []
        for lang_block in skill.get("alternativeLabel", {}).values():
            if isinstance(lang_block, list):
                alt_labels.extend(normalize_label(a) for a in lang_block if a)
            elif isinstance(lang_block, str) and lang_block:
                # ESCO collapses a single alt label to a bare string instead
                # of a one-item list for some skills.
                alt_labels.append(normalize_label(lang_block))
        # Deduplicate and exclude canonical itself
        alt_labels = sorted(set(a for a in alt_labels if a and a != canonical))[:6]
        entries[canonical] = (alt_labels, [])
    return entries


def format_python_entry(canonical: str, synonyms: list, adjacent: list) -> str:
    syns = json.dumps(synonyms)
    adj = json.dumps(adjacent)
    return f'    {json.dumps(canonical)}: ({syns}, {adj}),'


def positive_int(value: str) -> int:
    ivalue = int(value)
    if ivalue <= 0:
        raise argparse.ArgumentTypeError(f"--limit must be a positive integer, got {value}")
    return ivalue


def main():
    parser = argparse.ArgumentParser(description="Seed ESCO skills into taxonomy")
    parser.add_argument("--dry-run", action="store_true", help="Print entries without writing files")
    parser.add_argument("--limit", type=positive_int, default=200, help="Max skills to fetch (default 200)")
    args = parser.parse_args()

    print(f"[ESCO Seeder] Fetching up to {args.limit} skills from ESCO API...")
    try:
        skills = fetch_skills(limit=args.limit)
    except EscoRequestError as e:
        print(f"[ESCO Seeder] ABORT: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"[ESCO Seeder] Fetched {len(skills)} skills.")

    entries = build_taxonomy_entries(skills)
    print(f"[ESCO Seeder] Built {len(entries)} taxonomy entries.")

    lines = [
        '"""Auto-generated ESCO skill taxonomy extensions.',
        'Generated by scripts/seed_esco_taxonomy.py \u2014 do not edit manually.',
        'Merge desired entries into skill_taxonomy.py TAXONOMY dict.',
        '"""',
        "ESCO_EXTENSIONS: dict = {",
    ]
    for canonical, (synonyms, adjacent) in sorted(entries.items()):
        lines.append(format_python_entry(canonical, synonyms, adjacent))
    lines.append("}")

    output = "\n".join(lines) + "\n"

    if args.dry_run:
        print("\n--- ESCO EXTENSIONS (dry-run, not written) ---")
        print(output[:3000], "..." if len(output) > 3000 else "")
        return

    out_path = "backend/python/app/services/skill_taxonomy_esco.py"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(output)
    print(f"[ESCO Seeder] Written to {out_path}")
    print("Next: review the file, then merge desired entries into skill_taxonomy.py TAXONOMY dict.")


if __name__ == "__main__":
    main()
