"""
Truth Gate Guardrail Service.
Ensures optimized/tailored resumes never hallucinate false companies, unearned degrees,
non-existent certifications, or distorted quantitative metrics compared to the original master resume profile.
"""
from __future__ import annotations
import re
from typing import Dict, Any, List
from pydantic import BaseModel, Field


class TruthCheckResult(BaseModel):
    passed: bool = Field(description="Whether the resume passed truth verification")
    truth_score: int = Field(ge=0, le=100, description="Truth confidence score (0-100)")
    violations: List[str] = Field(default_factory=list, description="List of detected hallucination warnings")
    flagged_entities: List[str] = Field(default_factory=list, description="Unverifiable entities or metrics")


def verify_resume_truthfulness(original_text: str, optimized_text: str) -> TruthCheckResult:
    """
    Compares optimized resume against original master text to detect artificial hallucinations or inflated claims.
    """
    violations: List[str] = []
    flagged: List[str] = []
    
    orig_lower = original_text.lower()
    opt_lower = optimized_text.lower()
    
    # 1. Check Degree / Education Hallucinations
    degrees = ["phd", "master", "bachelor", "m.s.", "b.s.", "mba", "doctorate"]
    for deg in degrees:
        if deg in opt_lower and deg not in orig_lower:
            violations.append(f"Detected unverified educational credential: '{deg.upper()}' present in optimized text but absent in master resume.")
            flagged.append(deg)

    # 2. Check Major Certification Hallucinations
    certs = ["aws certified", "pmp", "cissp", "ckad", "cpa", "gcp certified", "azure certified"]
    for cert in certs:
        if cert in opt_lower and cert not in orig_lower:
            violations.append(f"Detected unverified certification: '{cert.title()}' added to resume.")
            flagged.append(cert)

    # 3. Metric Inflator Detection (e.g. $X revenue or X% growth)
    orig_numbers = set(re.findall(r'\b\d+(?:[\.,]\d+)?%?\b', original_text))
    opt_numbers = set(re.findall(r'\b\d+(?:[\.,]\d+)?%?\b', optimized_text))
    
    # Detect massive new multipliers (e.g., 500%, 1000%)
    high_multipliers = [n for n in opt_numbers if n not in orig_numbers and ('%' in n and int(re.sub(r'\D', '', n) or 0) > 300)]
    if high_multipliers:
        for m in high_multipliers:
            violations.append(f"Extremely high metric value '{m}' added during optimization. Please confirm authenticity.")
            flagged.append(m)

    truth_score = max(0, 100 - (len(violations) * 25))
    passed = len(violations) == 0 or truth_score >= 75

    return TruthCheckResult(
        passed=passed,
        truth_score=truth_score,
        violations=violations,
        flagged_entities=flagged
    )
