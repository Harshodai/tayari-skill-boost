#!/usr/bin/env python3
"""Migration parity check.

Fails if a file in backend/db/migrations/*.sql has no corresponding
individually-mounted file in supabase-local/volumes/db/init/*.sql AND
supabase-local/docker-compose.yml. Source: lessons.md 2026-09-10 —
migrations existing in backend/db/migrations/ but never mounted into
supabase-local's init sequence, found and fixed 3 separate times.

Matching is fuzzy because init/ files are renumbered with a "NN-" prefix
and sometimes drop their own internal ordinal ("_01_"): we match on the
8-digit date prefix (if any) plus overlap of descriptive word tokens.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = ROOT / "backend/db/migrations"
INIT_DIR = ROOT / "supabase-local/volumes/db/init"
COMPOSE_FILE = ROOT / "supabase-local/docker-compose.yml"

DATE_RE = re.compile(r"^(\d{8})")
WORD_RE = re.compile(r"[a-z]{3,}")


def tokens(stem: str):
    m = DATE_RE.match(stem)
    date = m.group(1) if m else None
    words = set(WORD_RE.findall(stem.lower()))
    # drop pure-ordinal noise words that show up as artifacts of numbering
    return date, words


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def find_match(mig_stem: str, init_stems):
    mig_date, mig_words = tokens(mig_stem)
    best, best_score = None, 0.0
    for init_stem in init_stems:
        # strip the leading "NN-" renumbering prefix
        stripped = re.sub(r"^\d+-", "", init_stem)
        init_date, init_words = tokens(stripped)
        if mig_date and init_date:
            if mig_date != init_date:
                continue
            score = jaccard(mig_words, init_words)
        else:
            score = jaccard(mig_words, init_words)
        if score > best_score:
            best, best_score = init_stem, score
    return best if best_score >= 0.34 else None


def main() -> int:
    migrations = sorted(p.name for p in MIGRATIONS_DIR.glob("*.sql"))
    init_files = sorted(p.name for p in INIT_DIR.glob("*.sql"))
    compose_text = COMPOSE_FILE.read_text()

    if not migrations:
        print(f"ERROR: no migrations found under {MIGRATIONS_DIR}", file=sys.stderr)
        return 2

    init_stems = [Path(f).stem for f in init_files]
    missing_from_init = []
    missing_from_mount = []

    for mig in migrations:
        mig_stem = Path(mig).stem
        match = find_match(mig_stem, init_stems)
        if match is None:
            missing_from_init.append(mig)
            continue
        if match not in compose_text:
            missing_from_mount.append((mig, match))

    ok = True
    if missing_from_init:
        ok = False
        print("MISSING from supabase-local/volumes/db/init/ (never mounted into self-hosted stack):")
        for m in missing_from_init:
            print(f"  - {m}")
    if missing_from_mount:
        ok = False
        print("MISSING volume mount in supabase-local/docker-compose.yml (file exists but not wired):")
        for mig, match in missing_from_mount:
            print(f"  - {mig} -> {match}")

    if ok:
        print(f"OK: all {len(migrations)} migrations under backend/db/migrations/ "
              f"have a matching mounted file in supabase-local/volumes/db/init/.")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
