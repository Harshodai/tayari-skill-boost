import logging
from .browser_library import Browser
from typing import Optional
from pydantic import BaseModel, Field, validator

logger = logging.getLogger(__name__)

class JobApplicationInput(BaseModel):
    title: str
    company: str
    url: str
    description: Optional[str] = None

    class Config:
        frozen = True  # enforce immutability

    @validator('url')
    def url_must_be_valid(cls, v: str) -> str:
        if not v.startswith('http'):
            raise ValueError('url must be a valid http URL')
        return v


def apply_job(job: dict, resume_text: str, cover_letter: str) -> str:
    """Apply to a job using the Browser stub with validated input.

    Args:
        job: Dictionary with job details (title, company, url, etc.).
        resume_text: Tailored resume text.
        cover_letter: Generated cover letter.

    Returns:
        str: The literal string ``'applied'`` on success.
    """
    # Validate job dict against immutable Pydantic model
    try:
        validated_job = JobApplicationInput(**job)
    except Exception as exc:
        logger.error("Invalid job data: %s", exc)
        raise

    try:
        success = Browser.apply_job(validated_job.dict(), resume_text, cover_letter)
        if success:
            logger.info("Job applied successfully: %s at %s", validated_job.title, validated_job.company)
            return "applied"
        else:
            raise RuntimeError("Browser.apply_job returned False")
    except Exception as exc:
        logger.error(
            "Failed to apply job %s at %s: %s",
            validated_job.title,
            validated_job.company,
            exc,
        )
        raise
