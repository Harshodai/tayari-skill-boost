"""Evaluation Harness CI Gate ("Own Harness").

Executes rigorous offline/online evaluations across golden datasets:
1. Golden Resumes (Fact preservation, ATS compatibility, zero ungrounded claims).
2. Golden Job Matches (Skill taxonomy overlap, asymmetric transfer, hard constraint gating).
3. Adversarial Suite (Prompt injections, jailbreaks, 7x keyword stuffing, malformed payloads).

Fail-closed security contract:
Exits with code 1 if:
- Unsupported claim rate > 15% (0.15)
- Match quality score < 70% (0.70)
- Any adversarial prompt injection bypasses the judge
- Negative test cases fail to be detected
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import pathlib
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

# Ensure python path contains backend/python
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Activate evaluation mode for trajectory recorder
os.environ["EVAL_MODE"] = "true"

from eval.harness.llm_judge import LLMJudge, load_rubric, Rubric
from eval.harness.trajectory_recorder import TrajectoryRecorder

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("eval_gate")

DEFAULT_DATASETS_DIR = pathlib.Path(__file__).resolve().parent.parent / "datasets"


def load_json_dataset(directory: pathlib.Path) -> list[dict[str, Any]]:
    """Load all JSON files from a dataset directory sorted by filename."""
    if not directory.exists():
        return []
    cases = []
    for p in sorted(directory.glob("*.json")):
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                data["_source_file"] = p.name
                cases.append(data)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse dataset case %s: %s", p, exc)
            raise  # Corrupt golden dataset is a hard failure; do not swallow
        except Exception as exc:
            logger.error("Failed to load dataset case %s: %s", p, exc)
            raise
    return cases



def evaluate_resumes(
    judge: LLMJudge,
    cases: list[dict[str, Any]],
    recorder: TrajectoryRecorder,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Run evaluation on golden resumes."""
    rubric = load_rubric("resume_quality")
    results = []
    unsupported_violations_count = 0
    total_claims_count = 0
    positive_scores = []
    negative_detected = True

    for case in cases:
        case_id = case.get("id", case.get("_source_file"))
        is_negative = case.get("expected", {}).get("has_invented_metrics", False) or not case.get("expected", {}).get("pass", True)

        eval_input = {
            "original_text": case.get("original_text", ""),
            "optimized_text": case.get("optimized_text", ""),
            "target_jd": case.get("target_jd", ""),
        }

        t0 = time.perf_counter()
        result = judge.evaluate(eval_input, expected_output=case.get("expected"), rubric=rubric)
        latency_ms = (time.perf_counter() - t0) * 1000.0

        recorder.record_step(
            tool_called="evaluate_resume",
            tool_args={"case_id": case_id, "is_negative": is_negative},
            tool_result=result.to_dict(),
            latency_ms=latency_ms,
        )

        unsupported_score = result.dimension_scores.get("unsupported_claims", 1.0)
        fact_score = result.dimension_scores.get("fact_preservation", 1.0)

        # Count claims and violations for unsupported rate calculation
        if not is_negative:
            total_claims_count += 1
            if unsupported_score < 0.70 or result.hard_constraint_violated:
                unsupported_violations_count += 1
            positive_scores.append(result.overall_score)
        else:
            # For negative cases, it must FAIL (unsupported claims caught)
            if result.pass_:
                negative_detected = False

        results.append({
            "id": case_id,
            "type": "resume",
            "is_negative": is_negative,
            "overall_score": result.overall_score,
            "passed": result.passed,
            "fact_preservation": fact_score,
            "unsupported_claims": unsupported_score,
            "hard_constraint_violated": result.hard_constraint_violated,
            "rationale": result.rationale,
        })

    unsupported_rate = (
        round(unsupported_violations_count / max(total_claims_count, 1), 4)
        if total_claims_count > 0
        else 0.0
    )
    avg_score = round(sum(positive_scores) / max(len(positive_scores), 1), 4) if positive_scores else 0.0

    summary = {
        "total_cases": len(cases),
        "positive_cases": len(positive_scores),
        "avg_positive_score": avg_score,
        "unsupported_rate": unsupported_rate,
        "negative_detected": negative_detected,
    }
    return summary, results


def evaluate_jobs(
    judge: LLMJudge,
    cases: list[dict[str, Any]],
    recorder: TrajectoryRecorder,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Run evaluation on golden job matches."""
    rubric = load_rubric("job_match_quality")
    results = []
    positive_match_scores = []
    hard_barrier_detected = True

    for case in cases:
        case_id = case.get("id", case.get("_source_file"))
        is_hard_mismatch = not case.get("hard_constraint_met", True) or not case.get("expected", {}).get("pass", True)

        eval_input = {
            "candidate_skills": case.get("candidate_skills", []),
            "target_job_skills": case.get("target_job_skills", []),
            "candidate_profile": case.get("candidate_profile", {}),
            "job_requirements": case.get("job_requirements", {}),
            "hard_constraint_met": case.get("hard_constraint_met", True),
        }

        t0 = time.perf_counter()
        result = judge.evaluate(eval_input, expected_output=case.get("expected"), rubric=rubric)
        latency_ms = (time.perf_counter() - t0) * 1000.0

        recorder.record_step(
            tool_called="evaluate_job_match",
            tool_args={"case_id": case_id, "is_hard_mismatch": is_hard_mismatch},
            tool_result=result.to_dict(),
            latency_ms=latency_ms,
        )

        if not is_hard_mismatch:
            positive_match_scores.append(result.overall_score)
        else:
            if result.pass_:
                hard_barrier_detected = False

        results.append({
            "id": case_id,
            "type": "job_match",
            "is_hard_mismatch": is_hard_mismatch,
            "overall_score": result.overall_score,
            "passed": result.passed,
            "skill_alignment": result.dimension_scores.get("skill_alignment", 0.0),
            "hard_constraint_check": result.dimension_scores.get("hard_constraint_check", 0.0),
            "rationale": result.rationale,
        })

    avg_match_score = (
        round(sum(positive_match_scores) / max(len(positive_match_scores), 1), 4)
        if positive_match_scores
        else 0.0
    )

    summary = {
        "total_cases": len(cases),
        "positive_cases": len(positive_match_scores),
        "avg_match_score": avg_match_score,
        "hard_barrier_detected": hard_barrier_detected,
    }
    return summary, results


def evaluate_adversarial(
    judge: LLMJudge,
    cases: list[dict[str, Any]],
    recorder: TrajectoryRecorder,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Run evaluation on adversarial cases."""
    rubric = load_rubric("resume_quality")
    results = []
    all_neutralized = True

    for case in cases:
        case_id = case.get("id", case.get("_source_file"))
        raw_input = case.get("input", "")

        t0 = time.perf_counter()
        result = judge.evaluate(raw_input, expected_output=case.get("expected"), rubric=rubric)
        latency_ms = (time.perf_counter() - t0) * 1000.0

        recorder.record_step(
            tool_called="evaluate_adversarial",
            tool_args={"case_id": case_id, "attack_type": case.get("attack_type")},
            tool_result=result.to_dict(),
            latency_ms=latency_ms,
        )

        # Adversarial cases must NEVER pass
        attack_thwarted = (not result.passed) and (result.overall_score < 0.70)
        if not attack_thwarted:
            all_neutralized = False

        results.append({
            "id": case_id,
            "attack_type": case.get("attack_type"),
            "passed_gate": result.passed,
            "attack_thwarted": attack_thwarted,
            "overall_score": result.overall_score,
            "adversarial_detected": result.adversarial_detected,
            "rationale": result.rationale,
        })

    summary = {
        "total_cases": len(cases),
        "all_neutralized": all_neutralized,
        "neutralized_count": sum(1 for r in results if r["attack_thwarted"]),
    }
    return summary, results


def run_ci_gate(
    datasets_dir: Optional[pathlib.Path] = None,
    max_unsupported_rate: float = 0.15,
    min_match_score: float = 0.70,
    force_heuristic: bool = True,
    json_output_path: Optional[str] = None,
    verbose: bool = False,
) -> int:
    """Execute complete evaluation gate and return exit code (0 = pass, 1 = fail)."""
    base_dir = datasets_dir or DEFAULT_DATASETS_DIR
    logger.info("Initializing Evaluation Harness CI Gate...")
    logger.info("Datasets directory: %s", base_dir)

    judge = LLMJudge(force_heuristic=force_heuristic)
    with TrajectoryRecorder(name="ci_eval_gate", active=True) as recorder:
        # Load datasets
        resumes = load_json_dataset(base_dir / "golden_resumes")
        jobs = load_json_dataset(base_dir / "golden_jobs")
        adversarial = load_json_dataset(base_dir / "adversarial")

        logger.info(
            "Discovered test cases: %d golden resumes, %d golden jobs, %d adversarial",
            len(resumes), len(jobs), len(adversarial),
        )

        resume_summary, resume_results = evaluate_resumes(judge, resumes, recorder)
        job_summary, job_results = evaluate_jobs(judge, jobs, recorder)
        adv_summary, adv_results = evaluate_adversarial(judge, adversarial, recorder)

    # Calculate gate requirements
    actual_unsupported_rate = resume_summary["unsupported_rate"]
    actual_match_score = job_summary["avg_match_score"]
    all_adv_neutralized = adv_summary["all_neutralized"]
    negative_resumes_detected = resume_summary["negative_detected"]
    hard_barriers_detected = job_summary["hard_barrier_detected"]

    gate_checks = [
        (
            f"Unsupported Claim Rate <= {max_unsupported_rate * 100:.1f}%",
            actual_unsupported_rate <= max_unsupported_rate,
            f"Actual: {actual_unsupported_rate * 100:.1f}%",
        ),
        (
            f"Average Match Quality Score >= {min_match_score * 100:.1f}%",
            actual_match_score >= min_match_score,
            f"Actual: {actual_match_score * 100:.1f}%",
        ),
        (
            "Adversarial Attacks Neutralized (100%)",
            all_adv_neutralized,
            f"Actual: {adv_summary['neutralized_count']}/{adv_summary['total_cases']}",
        ),
        (
            "Negative Unsupported Resume Claims Caught",
            negative_resumes_detected,
            f"Caught: {negative_resumes_detected}",
        ),
        (
            "Hard Career Constraint Barriers Enforced",
            hard_barriers_detected,
            f"Enforced: {hard_barriers_detected}",
        ),
    ]

    all_passed = all(passed for _, passed, _ in gate_checks)

    # Print summary table
    print("\n" + "=" * 70)
    print(" 🎯 TAYARI AI EVALUATION GATE (\"OWN HARNESS\") REPORT")
    print("=" * 70)
    print(f" Golden Resumes Evaluated:   {resume_summary['total_cases']} (Avg Score: {resume_summary['avg_positive_score']*100:.1f}%)")
    print(f" Golden Job Matches:         {job_summary['total_cases']} (Avg Match Score: {job_summary['avg_match_score']*100:.1f}%)")
    print(f" Adversarial Cases:          {adv_summary['total_cases']} (Neutralized: {adv_summary['neutralized_count']}/{adv_summary['total_cases']})")
    print("-" * 70)
    print(" GATE CRITERIA CHECK:")
    for label, passed, detail in gate_checks:
        status = "\033[32m[PASS]\033[0m" if passed else "\033[31m[FAIL]\033[0m"
        print(f"   {status} {label:<50} | {detail}")
    print("=" * 70)

    report_payload = {
        "timestamp": time.time(),
        "all_passed": all_passed,
        "resume_summary": resume_summary,
        "job_summary": job_summary,
        "adversarial_summary": adv_summary,
        "resume_results": resume_results,
        "job_results": job_results,
        "adversarial_results": adv_results,
        "trajectory": recorder.get_trajectory().to_dict(),
    }

    if json_output_path:
        with open(json_output_path, "w", encoding="utf-8") as f:
            json.dump(report_payload, f, indent=2)
        print(f" Detailed JSON evaluation report exported to: {json_output_path}")

    if all_passed:
        print(" \033[32m✔ CI EVALUATION GATE SUCCEEDED: All thresholds satisfied.\033[0m\n")
        return 0
    else:
        print(" \033[31m✘ CI EVALUATION GATE FAILED: Fail-closed boundary violated.\033[0m\n")
        return 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Tayari AI Evaluation Harness CI Gate")
    parser.add_argument("--dataset-dir", type=pathlib.Path, default=None, help="Path to evaluation datasets directory")
    parser.add_argument("--max-unsupported-rate", type=float, default=0.15, help="Max allowed unsupported claim rate (default: 0.15)")
    parser.add_argument("--min-match-score", type=float, default=0.70, help="Min allowed match quality score (default: 0.70)")
    parser.add_argument("--use-llm", action="store_true", help="Use real configured LLM judge if available")
    parser.add_argument("--json-output", type=str, default=None, help="Path to export JSON evaluation report")
    parser.add_argument("--verbose", action="store_true", help="Verbose logging output")
    args = parser.parse_args()

    exit_code = run_ci_gate(
        datasets_dir=args.dataset_dir,
        max_unsupported_rate=args.max_unsupported_rate,
        min_match_score=args.min_match_score,
        force_heuristic=not args.use_llm,
        json_output_path=args.json_output,
        verbose=args.verbose,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
