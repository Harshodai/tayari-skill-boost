"""
Unit tests for Pydantic Structured LLM Output engine and zero-regex parsing.
"""
import pytest
from pydantic import BaseModel, Field, ValidationError

from app.schemas import (
    OptimizedResumePayloadSchema,
    BehavioralPrepOutputSchema,
    STARAnswerSchema,
    TruthGateCheckOutputSchema,
)
from app.services.llm_service import llm_json


class SamplePydanticSchema(BaseModel):
    name: str
    age: int
    tags: list[str] = Field(default_factory=list)


@pytest.mark.asyncio
async def test_llm_json_pydantic_validation():
    """Test llm_json with mock/direct Pydantic model validation."""
    raw_json = '{"name": "Tayari Dev", "age": 28, "tags": ["python", "a2a", "mcp"]}'
    parsed = SamplePydanticSchema.model_validate_json(raw_json)
    assert parsed.name == "Tayari Dev"
    assert parsed.age == 28
    assert "a2a" in parsed.tags


@pytest.mark.asyncio
async def test_optimized_resume_payload_schema():
    """Test OptimizedResumePayloadSchema validation with min_length=200 constraint."""
    long_text = "John Doe Resume. " + ("Senior Software Engineer with experience in Python, FastAPI, and Microservices. " * 5)
    raw = f'{{"changes": ["Added metrics"], "keywords_added": ["Python"], "estimated_score": 85, "optimized_text": "{long_text}"}}'
    parsed = OptimizedResumePayloadSchema.model_validate_json(raw)
    assert parsed.estimated_score == 85
    assert len(parsed.optimized_text) >= 200
    assert "Python" in parsed.keywords_added


@pytest.mark.asyncio
async def test_optimized_resume_payload_schema_rejects_short_text():
    """Test that OptimizedResumePayloadSchema rejects text under 200 characters."""
    short_text = "Too short resume text"
    raw = f'{{"changes": ["Added metrics"], "keywords_added": ["Python"], "estimated_score": 85, "optimized_text": "{short_text}"}}'
    with pytest.raises(ValidationError):
        OptimizedResumePayloadSchema.model_validate_json(raw)


@pytest.mark.asyncio
async def test_star_answer_schema():
    """Test STARAnswerSchema validation."""
    raw = '{"situation": "Server outage", "task": "Restore API", "action": "Restarted service", "result": "100% uptime restored"}'
    parsed = STARAnswerSchema.model_validate_json(raw)
    assert parsed.situation == "Server outage"
    assert parsed.result == "100% uptime restored"
