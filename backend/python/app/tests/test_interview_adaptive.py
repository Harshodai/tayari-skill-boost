"""Tests for Adaptive Interview Coach STAR Analysis and Follow-up Generation (WP-07)."""
import pytest
from app.services.interview_ai import InterviewPrepGenerator
from app.services.mock_interview_simulator import MockInterviewSimulator


def test_empty_answer_returns_zero_score_and_foundation_prompt():
    res = InterviewPrepGenerator.analyze_star_answer("")
    assert res["completeness_score"] == 0
    assert res["star_score"] == 0
    assert "situation" in res["missing_elements"]
    assert "task" in res["missing_elements"]
    assert "action" in res["missing_elements"]
    assert "result" in res["missing_elements"]
    assert res["follow_up_target"] == "star_foundation"
    assert "STAR" in res["follow_up_question"]


def test_complete_star_answer_scores_high_with_metrics():
    # Sample complete STAR response
    answer = (
        "During peak Black Friday traffic at my previous company, our primary database cluster suffered sudden "
        "read-lock contention, spiking API latency to 4.2 seconds. As the lead on-call, my objective was to resolve "
        "the contention and prevent lost checkout transactions. I immediately investigated the slow queries, "
        "isolated the root cause to an un-indexed analytics scan, and I implemented an emergency Redis cache layer "
        "while diverting read traffic to our secondary replica mesh. Within 8 minutes, p99 latency dropped to 38ms, "
        "saving over $500k in potential checkout revenue with zero lost orders."
    )
    res = InterviewPrepGenerator.analyze_star_answer(answer)
    assert res["completeness_score"] >= 80
    assert res["breakdown"]["situation"]["present"] is True
    assert res["breakdown"]["situation"]["strength"] == "strong"
    assert res["breakdown"]["task"]["present"] is True
    assert res["breakdown"]["action"]["present"] is True
    assert res["breakdown"]["action"]["strength"] == "strong"
    assert res["breakdown"]["result"]["present"] is True
    assert res["breakdown"]["result"]["strength"] == "strong"
    assert "action" not in res["missing_elements"]
    assert "result" not in res["missing_elements"]
    assert res["follow_up_target"] == "deep_dive"


def test_missing_result_generates_adaptive_result_follow_up():
    # Answer has situation, task, action, but completely omits result
    answer = (
        "During a high-concurrency deployment at Acme Corp, our payment gateway began throwing 504 gateway timeout errors. "
        "I was tasked with identifying the bottleneck and restoring payment processing. "
        "I investigated the network socket utilization, identified connection pool exhaustion in our worker threads, "
        "and I refactored the connection timeout settings and deployed a pooled HTTP client to production."
    )
    res = InterviewPrepGenerator.analyze_star_answer(answer)
    assert res["breakdown"]["action"]["present"] is True
    assert "result" in res["missing_elements"] or "result" in res["weak_elements"]
    # Follow-up question must specifically target Result
    assert res["follow_up_target"] == "result"
    assert any(term in res["follow_up_question"].lower() for term in ["result", "outcome", "impact", "metric"])


def test_missing_action_generates_adaptive_action_follow_up():
    # Answer mentions problem and good outcome, but omits specific individual actions
    answer = (
        "In our checkout service, we had a major latency problem during sales. "
        "The goal was to get response times back under control. "
        "In the end, latency improved by 60% and checkout revenue increased by $100k with zero downtime."
    )
    res = InterviewPrepGenerator.analyze_star_answer(answer)
    assert "action" in res["missing_elements"] or "action" in res["weak_elements"]
    # Follow-up question must specifically target Action
    assert res["follow_up_target"] == "action"
    assert any(term in res["follow_up_question"].lower() for term in ["action", "personally", "steps", "took"])


def test_both_action_and_result_weak_generates_combined_adaptive_follow_up():
    # Answer only gives vague situation
    answer = (
        "When I was working on the customer onboarding flow at my company, "
        "we faced a challenge where users were dropping off during sign up."
    )
    res = InterviewPrepGenerator.analyze_star_answer(answer)
    assert res["completeness_score"] < 50
    assert "action" in res["missing_elements"] or "action" in res["weak_elements"]
    assert "result" in res["missing_elements"] or "result" in res["weak_elements"]
    assert res["follow_up_target"] == "action_and_result"
    assert "action" in res["follow_up_question"].lower()
    assert "outcome" in res["follow_up_question"].lower() or "impact" in res["follow_up_question"].lower()


def test_mock_interview_simulator_evaluate_answer_integration():
    sim_res = MockInterviewSimulator.evaluate_answer(
        question="Tell me about a high-severity production outage you diagnosed.",
        candidate_answer=(
            "During a system outage when our API went down, I led the emergency response team. "
            "I investigated the container memory limits, identified a memory leak in the WebSocket handler, "
            "and I deployed a patch that reduced memory consumption by 45%, resolving the incident in 12 minutes."
        ),
    )
    assert "score" in sim_res
    assert 0 <= sim_res["score"] <= 100
    assert sim_res["star_framework_detected"] is True
    assert "star_breakdown" in sim_res
    assert "follow_up_question" in sim_res
