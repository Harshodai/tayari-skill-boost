import uuid
from unittest.mock import AsyncMock, patch
import pytest

from app.services.cover_letter import CoverLetterGenerator


@pytest.mark.asyncio
async def test_cover_letter_generate_returns_id():
    with patch("app.services.cover_letter.LongContextClient") as mock_lcc_cls:
        mock_lcc = AsyncMock()
        mock_lcc.condense.return_value = "Condensed JD"
        mock_lcc.map_reduce.return_value = "Dear Team,\n\nI am thrilled to apply.\n\nBest,\nCandidate"
        mock_lcc_cls.return_value = mock_lcc

        result = await CoverLetterGenerator.generate(
            resume_text="Senior Software Engineer with 8 years building scalable services.",
            job_description="Looking for Senior Engineer",
            company_name="Acme Corp",
            job_title="Senior Engineer",
            tone="formal",
        )

        assert isinstance(result, dict)
        assert "id" in result
        uuid.UUID(result["id"])  # Validates it's a valid UUID
        assert result["company_name"] == "Acme Corp"
        assert result["job_title"] == "Senior Engineer"
        assert "cover_letter" in result
        assert result["word_count"] > 0


@pytest.mark.asyncio
async def test_cover_letter_generate_with_user_context():
    with patch("app.services.cover_letter.LongContextClient") as mock_lcc_cls:
        mock_lcc = AsyncMock()
        mock_lcc.condense.return_value = "Condensed JD"
        mock_lcc.map_reduce.return_value = "Dear Team,\n\nI am thrilled to apply.\n\nBest,\nCandidate"
        mock_lcc_cls.return_value = mock_lcc

        test_user_id = str(uuid.uuid4())
        with patch.object(CoverLetterGenerator, "save", new_callable=AsyncMock) as mock_save:
            mock_save.return_value = {"id": str(uuid.uuid4()), "user_id": test_user_id}

            result = await CoverLetterGenerator.generate(
                resume_text="Senior Software Engineer with 8 years building scalable services.",
                job_description="Looking for Senior Engineer",
                company_name="Acme Corp",
                job_title="Senior Engineer",
                user_id=test_user_id,
            )

            assert result["user_id"] == test_user_id
            assert result.get("saved") is True
            mock_save.assert_awaited_once()


@pytest.mark.asyncio
async def test_cover_letter_save_graceful_without_db():
    with patch("app.services.db.get_pool", return_value=None):
        saved = await CoverLetterGenerator.save(
            user_id=str(uuid.uuid4()),
            content="Some letter text",
            job_title="Engineer",
            company_name="Acme",
        )
        assert saved is None
