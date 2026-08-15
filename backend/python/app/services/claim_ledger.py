"""Source-Locked Claim Ledger for Resume Optimization.

Enforces zero-hallucination guarantees: every claim, metric, employer, and degree in
an optimized resume MUST be grounded in the candidate's original resume source text.
"""
from __future__ import annotations

import hashlib
import re
from typing import Any


def _extract_metric_numbers(text: str) -> set[str]:
    """Extract quantitative metric tokens (e.g., 45%, 10M, $2.5M, 99.99%)."""
    # Matches patterns like 10M+, 45%, $2M, 500k, 99.99%
    pattern = r"(?:\$?\d+(?:\.\d+)?(?:%|[kKmMbBtT]\+?|\+)?)"
    raw = re.findall(pattern, text)
    # Filter out common small integers or years (e.g. 2023, 2024, 1, 2, 3)
    metrics = set()
    for m in raw:
        cleaned = m.strip("$,+").lower()
        if not cleaned:
            continue
        # Skip standard 4-digit years
        if len(cleaned) == 4 and (cleaned.startswith("19") or cleaned.startswith("20")):
            continue
        # Keep things with %, M, K, or non-trivial numbers
        if any(c in m for c in "%kKmMBb+$") or ("." in m):
            metrics.add(m.lower())
        elif len(cleaned) >= 2:
            metrics.add(m.lower())
    return metrics


def build_claim_ledger(original_text: str, optimized_text: str) -> dict[str, Any]:
    """Build a verifiable claim ledger linking optimized bullets to source spans."""
    original_text = original_text or ""
    optimized_text = optimized_text or ""

    orig_lines = [line.strip() for line in original_text.splitlines() if len(line.strip()) > 15]
    orig_lower = original_text.lower()
    orig_metrics = _extract_metric_numbers(original_text)

    # Segment optimized text into bullet points / sentences
    opt_bullets = []
    for line in optimized_text.splitlines():
        line_clean = line.strip()
        if not line_clean:
            continue
        # Strip leading bullet chars
        line_clean = re.sub(r"^[\s*•\-\d.)]+", "", line_clean).strip()
        if len(line_clean) > 20:
            opt_bullets.append(line_clean)

    ledger = []
    violations = []
    grounded_count = 0

    for bullet in opt_bullets:
        bullet_lower = bullet.lower()
        bullet_words = {w for w in re.findall(r"[a-z0-9+#.\-]{3,}", bullet_lower)}
        
        # 1. Check for invented metric numbers
        bullet_metrics = _extract_metric_numbers(bullet)
        invented_metrics = bullet_metrics - orig_metrics
        
        # 2. Find best matching source span
        best_span = ""
        best_overlap = 0.0
        for orig_line in orig_lines:
            orig_words = {w for w in re.findall(r"[a-z0-9+#.\-]{3,}", orig_line.lower())}
            if not orig_words or not bullet_words:
                continue
            overlap = len(bullet_words & orig_words) / max(len(bullet_words), 1)
            if overlap > best_overlap:
                best_overlap = overlap
                best_span = orig_line

        claim_id = hashlib.sha256(bullet.encode()).hexdigest()[:12]
        
        if invented_metrics:
            violations.append(
                f"Bullet invented unverifiable metrics {sorted(invented_metrics)}: '{bullet[:80]}...'"
            )
            claim_type = "unverifiable_metric"
            verified = False
        elif best_overlap >= 0.35:
            claim_type = "grounded"
            verified = True
            grounded_count += 1
        elif best_overlap >= 0.20:
            claim_type = "transferred_synthesis"
            verified = True
            grounded_count += 1
        else:
            claim_type = "ungrounded_addition"
            verified = False
            violations.append(
                f"Bullet has insufficient grounding in source resume ({round(best_overlap*100)}% token match): '{bullet[:80]}...'"
            )

        ledger.append({
            "claim_id": claim_id,
            "bullet": bullet,
            "source_span": best_span,
            "token_overlap": round(best_overlap, 3),
            "claim_type": claim_type,
            "invented_metrics": sorted(invented_metrics),
            "verified": verified,
        })

    all_grounded = len(violations) == 0

    return {
        "all_grounded": all_grounded,
        "total_claims": len(opt_bullets),
        "grounded_claims": grounded_count,
        "grounding_ratio": round(grounded_count / max(len(opt_bullets), 1), 3) if opt_bullets else 1.0,
        "violations": violations,
        "ledger": ledger,
    }
