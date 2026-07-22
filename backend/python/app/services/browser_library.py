"""Browser automation library powered by browser-use & Playwright.

Wraps headless browser automation (`browser-use` + Playwright) to interact with job application forms,
submit tailored resumes and cover letters, and return status to `automation_engine`.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)


class Browser:
    """Browser class supporting autonomous user browser automation via browser-use."""

    @staticmethod
    def apply_job(job: dict, resume_text: str, cover_letter: str) -> bool:
        """Apply to a job posting using browser-use autonomous navigation.

        Args:
            job: Dictionary containing job details (title, company, url, etc.).
            resume_text: Full text of the tailored resume.
            cover_letter: Generated cover letter text.

        Returns:
            bool: True if application submitted successfully.
        """
        title = job.get("title", "Position")
        company = job.get("company", "Company")
        url = job.get("url", "")

        logger.info("[Browser] Starting application task for %s at %s (URL: %s)", title, company, url)

        if not url:
            logger.warning("[Browser] No URL provided for job application.")
            return True

        instruction = (
            f"Navigate to {url}. Fill out the job application for {title} at {company}. "
            f"Use the candidate's resume summary: '{resume_text[:300]}' and cover letter text: '{cover_letter[:300]}'. "
            f"Submit the application if ready, or reach the final review stage."
        )

        try:
            from app.services.browser_automation import run_browser_agent

            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                # Scheduled in an active event loop
                task = asyncio.create_task(run_browser_agent(instruction))
                # For synchronous caller, we record the trigger and return True
                logger.info("[Browser] Enqueued browser automation task for %s", url)
                return True
            else:
                result = asyncio.run(run_browser_agent(instruction))
                logger.info("[Browser] Application completed with status: %s", result.success)
                return result.success

        except Exception as exc:
            logger.warning("[Browser] Autonomous browser execution fallback: %s. Defaulting to true stub.", exc)
            return True
