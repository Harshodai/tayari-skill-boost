import pytest

from app.services.retrieval_evaluation import (
    RetrievalCase,
    evaluate_retrieval,
    family_precision_at_k,
    ndcg_at_k,
    recall_at_k,
)


def test_metrics_reward_relevant_and_family_consistent_ranking():
    assert recall_at_k(("a", "b", "c"), frozenset({"a", "b"}), 2) == 1.0
    assert ndcg_at_k(("a", "b", "c"), frozenset({"a", "b"}), 2) == 1.0
    assert family_precision_at_k(("a", "x"), frozenset({"a", "b"}), 2) == 0.5


def test_evaluate_retrieval_is_versioned_and_averages_cases():
    result = evaluate_retrieval(
        [
            RetrievalCase("q1", ("a", "b"), frozenset({"a"}), frozenset({"a", "b"})),
            RetrievalCase("q2", ("x", "a"), frozenset({"a"}), frozenset({"a"})),
        ],
        k=2,
    )
    assert result["version"] == "retrieval-v1"
    assert result["sample_size"] == 2
    assert result["recall_at_k"] == 1.0
    assert result["family_precision_at_k"] == 0.75


def test_empty_and_invalid_evaluation_inputs_are_explicit():
    result = evaluate_retrieval([], k=5)
    assert result["sample_size"] == 0
    assert result["ndcg_at_k"] is None
    with pytest.raises(ValueError):
        evaluate_retrieval([], k=0)
