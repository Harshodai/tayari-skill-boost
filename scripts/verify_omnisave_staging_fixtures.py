#!/usr/bin/env python3
"""Validate the sanitized OmniSaveAI staging fixture corpus.

This validator proves fixture completeness and deterministic expectations. It
never logs in, makes network calls, or claims that a live browser/staging run
has occurred.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parent.parent
CANONICAL_FIXTURE_PATH = ROOT / "tests" / "fixtures" / "omnisave" / "staging-corpus.json"
FALLBACK_FIXTURE_PATH = ROOT / "test-fixtures" / "omnisave" / "staging-corpus.json"
FIXTURE_PATH = CANONICAL_FIXTURE_PATH if CANONICAL_FIXTURE_PATH.exists() else FALLBACK_FIXTURE_PATH
REQUIRED_PLATFORMS = {"linkedin", "medium", "substack"}
REQUIRED_NEGATIVES = {"login_wall", "paywall", "cross_platform_host"}
PLATFORM_ROOTS = {
    "linkedin": {"linkedin.com"},
    "medium": {"medium.com"},
    "substack": {"substack.com"},
}


def canonical(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise AssertionError(f"fixture URL must be HTTPS: {value}")
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", parsed.query, ""))


def host_matches(platform: str, value: str) -> bool:
    host = (urlsplit(value).hostname or "").lower().rstrip(".")
    return any(host == root or host.endswith(f".{root}") for root in PLATFORM_ROOTS[platform])


def validate() -> dict:
    corpus = json.loads(FIXTURE_PATH.read_text())
    assert corpus.get("schema") == "tayari.omnisave-staging-fixtures.v1"
    platforms = corpus.get("platforms") or {}
    assert set(platforms) == REQUIRED_PLATFORMS, f"platforms={set(platforms)}"

    summary = {"platforms": {}, "pages": 0, "items": 0, "unique_items": 0, "negative_cases": 0}
    for platform in sorted(REQUIRED_PLATFORMS):
        definition = platforms[platform]
        source_page = canonical(definition["source_page_url"])
        assert host_matches(platform, source_page), f"source page host mismatch: {platform} {source_page}"
        pages = definition.get("pages") or []
        assert len(pages) >= 2, f"{platform} needs at least two pages for pagination evidence"
        seen = set()
        raw_items = 0
        for index, page in enumerate(pages):
            assert page.get("cursor"), f"{platform} page {index} missing cursor"
            assert page.get("content_signature"), f"{platform} page {index} missing content signature"
            assert index == len(pages) - 1 or page.get("next"), f"{platform} page {index} missing next cursor"
            for item in page.get("items") or []:
                raw_items += 1
                url = canonical(item["url"])
                assert host_matches(platform, url), f"{platform} item host mismatch: {url}"
                assert item.get("title") and item.get("content") is not None
                for media in item.get("media") or []:
                    media_url = canonical(media["url"])
                    assert media.get("type") and len(media_url) <= 2048
                seen.add((platform, url))
        negatives = {case.get("name") for case in definition.get("negative_cases") or []}
        assert "login_wall" in negatives, f"{platform} missing login-wall case"
        if platform in {"medium", "substack"}:
            assert "paywall" in negatives, f"{platform} missing paywall case"
        if platform == "linkedin":
            assert "cross_platform_host" in negatives, "linkedin missing cross-platform case"
        summary["platforms"][platform] = {"pages": len(pages), "raw_items": raw_items, "unique_items": len(seen), "negative_cases": sorted(negatives)}
        summary["pages"] += len(pages)
        summary["items"] += raw_items
        summary["unique_items"] += len(seen)
        summary["negative_cases"] += len(negatives)

    assert summary["items"] > summary["unique_items"], "corpus must include a duplicate for idempotency coverage"
    assert summary["negative_cases"] >= len(REQUIRED_NEGATIVES), "negative coverage is incomplete"
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", action="store_true", help="Print fixture requirements without reading the corpus")
    args = parser.parse_args()
    if args.plan:
        print(json.dumps({"fixture": str(FIXTURE_PATH.relative_to(ROOT)), "platforms": sorted(REQUIRED_PLATFORMS), "live_requirements": ["authenticated browser sessions", "two disposable staging tenants", "real staging alert receiver"]}, indent=2))
        return 0
    summary = validate()
    print(json.dumps({"status": "PASS", **summary}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
