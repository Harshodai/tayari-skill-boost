import logging
from .browser_library import Browser

logger = logging.getLogger(__name__)


def apply_job(job: dict, resume_text: str, cover_letter: str) -> str:
    """Apply to a job using the Browser stub.

    Args:
        job: Dictionary with job details (title, company, url, etc.).
        resume_text: Tailored resume text.
        cover_letter: Generated cover letter.

    Returns:
        str: The literal string ``'applied'`` on success.

    Raises:
        Exception: Propagates any exception raised by ``Browser.apply_job``.
    """
    try:
        success = Browser.apply_job(job, resume_text, cover_letter)
        if success:
            logger.info("Job applied successfully: %s at %s", job.get("title"), job.get("company"))
            return "applied"
        else:
            raise RuntimeError("Browser.apply_job returned False")
    except Exception as exc:
        logger.error(
            "Failed to apply job %s at %s: %s", job.get("title"), job.get("company"), exc
        )
        raise
