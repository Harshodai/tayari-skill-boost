'''Job application automation using Browser library.

Provides a thin wrapper around the ``Browser`` stub (or real implementation) to apply to a job posting.
'''

import logging
from .browser_library import Browser

logger = logging.getLogger(__name__)


def apply_job(job: dict, resume_text: str, cover_letter: str) -> str:
    """Apply to a job using the Browser automation.

    Args:
        job: Dictionary with job details (title, company, url, etc.).
        resume_text: Full resume text (potentially tailored).
        cover_letter: Generated cover letter.

    Returns:
        str: Application status – ``"applied"`` on success.
    """
    try:
        success = Browser.apply_job(job, resume_text, cover_letter)
        if not success:
            raise RuntimeError('Browser reported failure')
        logger.info('Job applied via Browser: %s @ %s', job.get('title'), job.get('company'))
        return 'applied'
    except Exception as exc:
        logger.error('Browser automation failed: %s', exc)
        raise
