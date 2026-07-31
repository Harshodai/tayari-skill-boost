"""Browser automation library powered by browser-use & Playwright.

Wraps headless browser automation (`browser-use` + Playwright) to interact with job application forms,
submit tailored resumes and cover letters, and return status to `automation_engine`.
"""

import asyncio
import logging
import threading

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
            bool: True only if a real application was actually submitted (and
            confirmed) by the browser automation agent. False in every other
            case - missing input, import/runtime failure, or automation
            failure. This method must never report success it hasn't verified.
        """
        title = job.get("title", "Position")
        company = job.get("company", "Company")
        url = job.get("url", "")

        logger.info("[Browser] Starting application task for %s at %s (URL: %s)", title, company, url)

        if not url:
            logger.warning("[Browser] No URL provided for job application; nothing to apply to.")
            return False

        instruction = (
            f"Navigate to {url}. Fill out the job application for {title} at {company}.\n"
            f"Candidate Resume Data:\n{resume_text}\n\n"
            f"Cover Letter:\n{cover_letter}\n\n"
            f"Fill out all mandatory fields (Full Name, Email, Phone, Work Authorization, Experience summary) accurately from the provided candidate resume data. "
            f"If an upload field for resume or cover letter exists, attach or paste the tailored content. Reach the final review step or submit if ready."
        )

        try:
            from app.services.browser_automation import run_browser_agent

            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                # We're being invoked synchronously from code that is itself
                # running on an active event loop (automation_engine's async
                # pipeline calls this via job_application_automation.apply_job,
                # a plain sync function). We can't `await` here without making
                # this method async, and we must not fire-and-forget with
                # asyncio.create_task(...) - that returns before the agent has
                # done anything, which is exactly the "lie about success" bug.
                #
                # Instead, run the coroutine to completion on a dedicated
                # thread with its own event loop and block until it actually
                # finishes, so the boolean returned reflects a real, confirmed
                # result rather than a merely-scheduled one.
                result_box: dict = {}

                def _run_in_thread() -> None:
                    try:
                        result_box["result"] = asyncio.run(run_browser_agent(instruction))
                    except Exception as thread_exc:  # noqa: BLE001 - re-raised on the caller's thread below
                        result_box["error"] = thread_exc

                worker = threading.Thread(target=_run_in_thread, daemon=True)
                worker.start()
                worker.join()

                if "error" in result_box:
                    raise result_box["error"]

                result = result_box["result"]
            else:
                result = asyncio.run(run_browser_agent(instruction))

            logger.info("[Browser] Application completed with status: %s", result.success)
            return bool(result.success)

        except Exception as exc:
            logger.error(
                "[Browser] Browser automation failed for %s at %s (URL: %s): %s",
                title,
                company,
                url,
                exc,
            )
            return False
