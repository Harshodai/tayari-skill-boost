import pytest
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock
from app.services import pattern_analyzer, followup_tracker

# Fake DB setup helpers
class FakeRecord(dict):
    def __getitem__(self, key):
        return super().get(key)

class FakePool:
    def __init__(self, rows):
        self.rows = rows
        self.executes = []
        
    def acquire(self):
        return self
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
        
    async def fetch(self, sql, *args):
        return [FakeRecord(r) for r in self.rows]
        
    async def execute(self, sql, *args):
        self.executes.append((sql, args))
        return "UPDATE 1"

@pytest.mark.asyncio
async def test_analyze_rejection_patterns(monkeypatch):
    # Setup mock rows
    mock_rows = [
        {
            "stage": "applied",
            "title": "Software Engineer",
            "company": "Google",
            "location": "Remote",
            "dream_score": 4,
            "review_notes": "Applied online",
            "legitimacy_assessment": None,
            "evaluation_report": json.dumps({"archetype": "SA", "block_a": {"remote": "Remote"}})
        },
        {
            "stage": "rejected",
            "title": "Data Scientist",
            "company": "Meta",
            "location": "New York",
            "dream_score": 3,
            "review_notes": "Downlevel proposal rejected",
            "legitimacy_assessment": None,
            "evaluation_report": json.dumps({"archetype": "PM", "block_a": {"remote": "Hybrid"}})
        }
    ]
    
    fake_pool = FakePool(mock_rows)
    monkeypatch.setattr(pattern_analyzer, "get_pool", AsyncMock(return_value=fake_pool))
    
    mock_llm_json = AsyncMock(return_value={
        "score_threshold_rationale": "Focus on score 4.0 and above.",
        "recommendations": [{"action": "Apply to SA roles", "reasoning": "High match", "impact": "High"}]
    })
    monkeypatch.setattr(pattern_analyzer, "llm_json", mock_llm_json)
    
    res = await pattern_analyzer.analyze_rejection_patterns("user_123")
    assert res["total_analyzed"] == 2
    assert res["funnel"]["applied"] == 1
    assert res["funnel"]["rejected"] == 1
    assert res["score_averages"]["positive"] == 4.0
    assert res["score_averages"]["negative"] == 3.0
    assert res["score_threshold_rationale"] == "Focus on score 4.0 and above."
    assert len(res["recommendations"]) == 1
    assert res["recommendations"][0]["action"] == "Apply to SA roles"


@pytest.mark.asyncio
async def test_track_followup_cadence(monkeypatch):
    now = datetime.now(timezone.utc)
    mock_rows = [
        {
            "id": 1,
            "application_id": "app_1",
            "stage": "applied",
            "title": "DevOps Engineer",
            "company": "Amazon",
            "location": "Seattle",
            "updated_at": now - timedelta(days=10),
            "evaluation_report": None,
            "notes_log": json.dumps([])
        },
        {
            "id": 2,
            "application_id": "app_2",
            "stage": "responded",
            "title": "Backend Engineer",
            "company": "Netflix",
            "location": "Remote",
            "updated_at": now - timedelta(days=5),
            "evaluation_report": None,
            "notes_log": json.dumps([{"text": "sent first follow-up"}]) # followups_sent = 0 because it doesn't contain "follow-up" case insensitively
        }
    ]
    
    fake_pool = FakePool(mock_rows)
    monkeypatch.setattr(followup_tracker, "get_pool", AsyncMock(return_value=fake_pool))
    
    mock_llm_complete = AsyncMock(return_value="  Dear Amazon, here is my follow up email.  ")
    monkeypatch.setattr(followup_tracker, "llm_complete", mock_llm_complete)
    
    res = await followup_tracker.track_followup_cadence("user_123")
    assert len(res) == 2
    
    # Check Amazon (applied 10 days ago -> overdue)
    assert res[0]["company"] == "Amazon"
    assert res[0]["urgency"] == "overdue"
    assert "application with no response" in res[0]["reason"]
    assert res[0]["draft_subject"] == "Re: DevOps Engineer application — Amazon"
    assert res[0]["draft_body"] == "Dear Amazon, here is my follow up email."
    
    # Check Netflix (responded 5 days ago -> urgent)
    assert res[1]["company"] == "Netflix"
    assert res[1]["urgency"] == "urgent"
    assert "days since company responded" in res[1]["reason"]
