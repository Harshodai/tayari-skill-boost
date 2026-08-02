"""Unit tests for whole-token, longest-match skill clustering."""

from app.services.graph_communities import GraphCommunitiesEngine


def test_whole_tokens_match_case_insensitively():
    skills = ["JavaScript", "Go", "CI/CD", "Next.js", "Scikit-Learn", "Kubernetes"]
    clusters = GraphCommunitiesEngine.cluster_skills(skills)
    assert skills[0] in clusters["Frontend"]
    assert skills[1] in clusters["Backend"]
    assert skills[2] in clusters["Cloud & DevOps"]
    assert skills[3] in clusters["Frontend"]
    assert skills[4] in clusters["Data & AI"]
    assert skills[5] in clusters["Cloud & DevOps"]


def test_short_keyword_does_not_match_substrings():
    clusters = GraphCommunitiesEngine.cluster_skills(["golang", "google", "google cloud", "mongo"])
    for skill in ["golang", "google", "google cloud", "mongo"]:
        assert skill in clusters["Other Skills"]


def test_longest_keyword_wins():
    clusters = GraphCommunitiesEngine.cluster_skills(["go javascript"])
    assert "go javascript" in clusters["Frontend"]


def test_existing_behavior_kept():
    clusters = GraphCommunitiesEngine.cluster_skills(["Python", "Go", "Kubernetes", "React", "PyTorch"])
    assert "Backend" in clusters
    assert "Cloud & DevOps" in clusters
