from __future__ import annotations
"""Browser automation library powered by browser-use & Playwright.

Wraps headless browser automation (`browser-use` + Playwright) to interact with job application forms,
submit tailored resumes and cover letters, and return status to `automation_engine`.
"""

import asyncio
import logging
import threading
from urllib.parse import urlsplit

from app.services.linkedin_policy import assert_not_linkedin_automation, LinkedInAutomationBlocked
from app.services.submission_guard import verify_guard

logger = logging.getLogger(__name__)


class Browser:
    """Browser class supporting autonomous user browser automation via browser-use."""

    @staticmethod
    def _build_instruction(job: dict, resume_text: str, cover_letter: str, form_fields: dict | None = None) -> str:
        title = job.get("title", "Position")
        company = job.get("company", "Company")
        url = job.get("url", "")
        return (
            f"Navigate to {url}. Fill out the job application for {title} at {company}.\n"
            f"Candidate Resume Data:\n{resume_text}\n\n"
            f"Cover Letter:\n{cover_letter}\n\n"
            f"Approved Application Fields:\n{form_fields or {}}\n\n"
            f"Fill out all mandatory fields (Full Name, Email, Phone, Work Authorization, Experience summary) accurately from the provided candidate resume data. "
            f"If an upload field for resume or cover letter exists, attach or paste the tailored content. Reach the final review step or submit if ready.\n"
            f"After the final action, report the exact confirmation message the site displayed, "
            f"including any confirmation or reference number. If no confirmation appeared, say so plainly."
        )

    @staticmethod
    def _run_agent(
        instruction: str,
        start_url: str | None = None,
        *,
        allow_submission: bool = False,
        allowed_field_labels: set[str] | None = None,
        run_id: str | None = None,
        owner_id: str | None = None,
    ):
        """Run the browser agent to completion and return its AgentResult."""
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
            # finishes, so the result reflects a real, confirmed outcome
            # rather than a merely-scheduled one.
            result_box: dict = {}

            def _run_in_thread() -> None:
                try:
                    result_box["result"] = asyncio.run(
                        run_browser_agent(
                            instruction,
                            start_url=start_url,
                            allow_submission=allow_submission,
                            allowed_field_labels=allowed_field_labels,
                            run_id=run_id,
                            owner_id=owner_id,
                        )
                    )
                except Exception as thread_exc:  # noqa: BLE001 - re-raised on the caller's thread below
                    result_box["error"] = thread_exc

            worker = threading.Thread(target=_run_in_thread, daemon=True)
            worker.start()
            worker.join()

            if "error" in result_box:
                raise result_box["error"]

            return result_box["result"]

        return asyncio.run(
            run_browser_agent(
                instruction,
                start_url=start_url,
                allow_submission=allow_submission,
                allowed_field_labels=allowed_field_labels,
                run_id=run_id,
                owner_id=owner_id,
            )
        )

    @staticmethod
    def apply_job_with_evidence(
        job: dict,
        resume_text: str,
        cover_letter: str,
        *,
        form_fields: dict | None = None,
        submission_guard: dict | None = None,
    ) -> dict:
        """Apply to a job and return the raw evidence the run produced.

        WS-02: the boolean-only variant below throws away everything needed to
        prove a submission happened. This returns the agent's own account of
        the run — summary, actions, the URL it finished on and the final
        screenshot — so :mod:`app.services.submission_receipt` can decide
        whether the submission is *verified* rather than merely attempted.

        Never raises: a failed run is reported as ``success=False`` with the
        error attached, because the caller's job is to record what happened.
        """
        title = job.get("title", "Position")
        company = job.get("company", "Company")
        url = job.get("url", "")
        run_id = str((submission_guard or {}).get("run_id") or "") or None
        owner_id = str((submission_guard or {}).get("user_id") or "") or None

        if not verify_guard(
            submission_guard,
            user_id=owner_id or "",
            run_id=run_id or "",
            job=job,
            resume_text=resume_text,
            cover_letter=cover_letter,
            form_fields=form_fields,
        ):
            logger.warning("[Browser] Final-action guard rejected application for %s at %s", title, url)
            return {"success": False, "error": "submission_guard_rejected", "summary": "Final submission guard rejected the application.", "actions": []}

        logger.info("[Browser] Starting application task for %s at %s (URL: %s)", title, company, url)

        if not url:
            logger.warning("[Browser] No URL provided for job application; nothing to apply to.")
            return {"success": False, "error": "no_job_url", "summary": "", "actions": []}

        # Defense-in-depth: automation_engine already guards this, but a
        # future caller could bypass it. Block LinkedIn submissions here too
        # so the legal boundary holds regardless of the entry path.
        try:
            assert_not_linkedin_automation(url, "submit")
        except LinkedInAutomationBlocked:
            logger.warning(
                "[Browser] Refused LinkedIn automation for %s at %s (UA §8.2): %s",
                title, company, url,
            )
            return {
                "success": False,
                "error": "linkedin_automation_blocked",
                "summary": "LinkedIn automation not permitted by policy (UA §8.2).",
                "actions": [],
            }

        instruction = Browser._build_instruction(job, resume_text, cover_letter, form_fields)

        try:
            # ponytail: the caller-supplied job URL is the authoritative
            # credential-origin allowlist source; instruction text is never
            # trusted to change it (explicit start_url always wins over the
            # instruction-parsing fallback inside run_browser_agent).
            result = Browser._run_agent(
                instruction,
                start_url=url,
                allow_submission=True,
                allowed_field_labels=set((form_fields or {}).keys()),
                run_id=run_id,
                owner_id=owner_id,
            )
            final_url = getattr(result, "final_url", None)
            if final_url and urlsplit(final_url).netloc.lower() != urlsplit(url).netloc.lower():
                logger.warning("[Browser] Final-action guard rejected cross-origin evidence: %s", final_url)
                return {"success": False, "error": "final_origin_mismatch", "summary": "Browser evidence ended on an unapproved origin.", "actions": []}
            logger.info("[Browser] Application completed with status: %s", result.success)
            return {
                "success": bool(result.success),
                "summary": getattr(result, "summary", "") or "",
                "actions": list(getattr(result, "actions", []) or []),
                "visited_urls": list(getattr(result, "visited_urls", []) or []),
                "final_url": final_url,
                "screenshot_b64": getattr(result, "final_screenshot", None),
                "error": getattr(result, "error", None),
            }
        except Exception as exc:
            logger.error(
                "[Browser] Browser automation failed for %s at %s (URL: %s): %s",
                title,
                company,
                url,
                exc,
            )
            return {"success": False, "error": str(exc), "summary": "", "actions": []}

    @staticmethod
    def apply_job(
        job: dict,
        resume_text: str,
        cover_letter: str,
        *,
        form_fields: dict | None = None,
        submission_guard: dict | None = None,
    ) -> bool:
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
        url = job.get("url", "")

        # (a) URL validation: if no valid URL provided, return False immediately
        if not url:
            logger.warning("[Browser] No job URL provided")
            return False

        # (b) Restructured error handling: delegate to apply_job_with_evidence
        #     which has proper URL validation and specific exception handling.
        #     We do not broadly catch all exceptions here; instead we let
        #     specific errors propagate naturally.
        try:
            result = Browser.apply_job_with_evidence(
                job,
                resume_text,
                cover_letter,
                form_fields=form_fields,
                submission_guard=submission_guard,
            )
            return bool(result.get("success"))
        except Exception as exc:
            logger.error(
                "[Browser] Browser automation failed for %s at %s: %s",
                job.get("title", "Position"),
                job.get("company", "Company"),
                exc,
            )
            return False

        # (c) Event-loop-aware execution: if called from a running asyncio
        #     event loop, we must not fire-and-forget with create_task. Instead,
        #     the call chain (via _run_agent) already uses threading to block
        #     until the agent completes, so the returned result reflects a real
        #     outcome rather than a merely-scheduled task.

