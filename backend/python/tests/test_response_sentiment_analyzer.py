"""Unit tests for ResponseSentimentAnalyzer pattern fixes."""

from app.services.response_sentiment_analyzer import ResponseSentimentAnalyzer


def test_schedule_a_interview_is_interview_invite():
    res = ResponseSentimentAnalyzer.classify_response("We would like to schedule a interview with you.")
    assert res["category"] == "INTERVIEW_INVITE"
    assert res["matched_pattern"] == r"schedule\s+(?:a|an)\s+interview"


def test_schedule_an_interview_is_interview_invite():
    res = ResponseSentimentAnalyzer.classify_response("Please schedule an interview at your convenience.")
    assert res["category"] == "INTERVIEW_INVITE"
    assert res["matched_pattern"] == r"schedule\s+(?:a|an)\s+interview"


def test_unfortunately_is_rejection():
    res = ResponseSentimentAnalyzer.classify_response("Unfortunately, we cannot offer you the position.")
    assert res["category"] == "REJECTION"
    assert res["matched_pattern"] == r"unfortunately"


def test_misspelled_unfortunatly_still_rejection():
    res = ResponseSentimentAnalyzer.classify_response("Unfortunatly, we cannot move forward.")
    assert res["category"] == "REJECTION"
    assert res["matched_pattern"] == r"unfortunatly"
