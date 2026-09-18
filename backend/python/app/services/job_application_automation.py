import logging
from .action_policy import require_manual_submission
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator

logger = logging.getLogger(__name__)

class JobApplicationInput(BaseModel):
    title: str
    company: str
    url: str
    description: Optional[str] = None

    model_config = ConfigDict(frozen=True)

    @field_validator('url')
    @classmethod
    def url_must_be_valid(cls, v: str) -> str:
        if not v.startswith('http'):
            raise ValueError('url must be a valid http URL')
        return v


def apply_job(job: dict, resume_text: str, cover_letter: str) -> str:
    """Validate an application package and enforce the manual-submit boundary.

    Args:
        job: Dictionary with job details (title, company, url, etc.).
        resume_text: Tailored resume text.
        cover_letter: Generated cover letter.

    This legacy entry point remains for compatibility, but it never starts a
    browser or reports an external submission. Callers must create a durable
    candidate handoff instead.
    """
    # Validate job dict against immutable Pydantic model
    try:
        validated_job = JobApplicationInput(**job)
    except Exception as exc:
        logger.error("Invalid job data: %s", exc)
        raise

    decision = require_manual_submission(validated_job.url)
    if not decision.allowed:
        logger.info("Manual submission required: %s at %s", validated_job.title, validated_job.company)
        return "awaiting_manual_submission"
    raise RuntimeError("manual-submit policy unexpectedly allowed final submission")
