import asyncio
import hashlib
import json
import urllib.parse
import uuid
from typing import Dict, Any, List, Optional
from app.agent.agent_engine import GeneralistAgentEngine
from app.agent.email_connector import EmailConnector
from app.agent.interview_board import InterviewBoardEngine
from app.services.form_filler import FormFiller
from app.services.llm_service import llm_complete, LLMNotConfiguredError
from app.services.optimizer import optimize_with_reflection

PORTAL_DOMAIN_MAP = {
    "greenhouse.io": "Greenhouse",
    "lever.co": "Lever",
    "ashbyhq.com": "Ashby",
    "myworkdayjobs.com": "Workday",
    "bamboohr.com": "BambooHR",
    "smartrecruiters.com": "SmartRecruiters",
    "jobvite.com": "Jobvite",
    "workable.com": "Workable",
    "taleo.net": "Taleo",
    "icims.com": "iCIMS",
    "successfactors.com": "SuccessFactors",
    "jazzhr.com": "JazzHR",
    "breezy.hr": "Breezy HR",
    "pinpointhq.com": "Pinpoint",
    "workatastartup.com": "YC Work at a Startup",
    "wellfound.com": "Wellfound",
    "otta.com": "Otta",
    "topstartups.io": "TopStartups",
    "hired.com": "Hired",
    "builtin.com": "BuiltIn",
    "remoteok.com": "RemoteOK",
    "weworkremotely.com": "WeWorkRemotely",
    "linkedin.com": "LinkedIn",
    "indeed.com": "Indeed",
    "ziprecruiter.com": "ZipRecruiter",
    "ripplematch.com": "RippleMatch",
    "joinhandshake.com": "Handshake",
    "glassdoor.com": "Glassdoor",
    "simplyhired.com": "SimplyHired",
}

from collections import OrderedDict
import time

_MAX_CACHE_SIZE = 500
_CACHE_TTL_SECONDS = 3600.0  # 1 hour TTL
_GLOBAL_PENDING_HITL_APPROVALS: OrderedDict[str, Dict[str, Any]] = OrderedDict()


def _add_global_approval(approval_id: str, proposal: Dict[str, Any]) -> None:
    now = time.time()
    expired = [k for k, v in _GLOBAL_PENDING_HITL_APPROVALS.items() if now - v.get("_cached_at", 0) > _CACHE_TTL_SECONDS]
    for k in expired:
        _GLOBAL_PENDING_HITL_APPROVALS.pop(k, None)
    while len(_GLOBAL_PENDING_HITL_APPROVALS) >= _MAX_CACHE_SIZE:
        _GLOBAL_PENDING_HITL_APPROVALS.popitem(last=False)
    proposal_copy = dict(proposal)
    proposal_copy["_cached_at"] = now
    _GLOBAL_PENDING_HITL_APPROVALS[approval_id] = proposal_copy


def _get_global_approval(approval_id: str) -> Optional[Dict[str, Any]]:
    entry = _GLOBAL_PENDING_HITL_APPROVALS.get(approval_id)
    if entry is None:
        return None
    if time.time() - entry.get("_cached_at", 0) > _CACHE_TTL_SECONDS:
        _GLOBAL_PENDING_HITL_APPROVALS.pop(approval_id, None)
        return None
    _GLOBAL_PENDING_HITL_APPROVALS.move_to_end(approval_id)
    return entry


def _remove_global_approval(approval_id: str) -> None:
    _GLOBAL_PENDING_HITL_APPROVALS.pop(approval_id, None)


class AutonomousCareerEngine:
    """
    Executive Career Automation Engine.
    Coordinates local agent tools, email connector parsing, Kanban interview board tracking,
    and compensation strategy templates.
    """

    def __init__(self, workspace_path: str = "./", user_id: Optional[str] = None):
        self.workspace_path = workspace_path
        self.user_id = user_id
        self.agent = GeneralistAgentEngine(workspace_path=workspace_path, user_id=user_id)
        self.email_connector = EmailConnector()
        self.interview_board = InterviewBoardEngine()
        self.pending_hitl_approvals: Dict[str, Dict[str, Any]] = {}

    async def scan_and_sync_email_invites(self) -> Dict[str, Any]:
        """
        Scan email inbox for recruiter interview invites and automatically populate the Interview Board.
        """
        scan_res = await self.email_connector.scan_inbox_for_interview_invites()
        
        # Auto-populate Interview Board with newly detected invites
        added_cards = []
        for invite in scan_res.get("parsed_invites", []):
            role = invite.get("role") or "Unclassified Role"
            stage = invite.get("stage") or "APPLIED"
            card_res = self.interview_board.add_interview_card(
                company=invite.get("company", "Unknown Company"),
                role=role,
                stage=stage,
                interview_date=invite.get("proposed_date", "TBD")
            )
            added_cards.append(card_res["card"])

        return {
            "email_scan_summary": scan_res,
            "auto_synced_kanban_cards": added_cards,
            "current_kanban_board": self.interview_board.get_kanban_board()
        }

    async def prepare_ats_keyword_optimization_hitl(
        self,
        resume_text: str,
        job_description: str,
        *,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the real optimizer and hold its result for explicit review with cryptographic bindings."""
        if not resume_text.strip() or not job_description.strip():
            raise ValueError("resume_text and job_description are required")

        analysis = await optimize_with_reflection(
            resume_text=resume_text,
            job_description=job_description,
        )
        keyword_matrix = analysis.get("keyword_matrix") or {}
        extracted_keywords = list(dict.fromkeys(
            analysis.get("keywords_added")
            or analysis.get("injectable_keywords")
            or [
                item["keyword"]
                for key in ("hard_skills_matrix", "soft_skills_matrix", "domain_matrix")
                for item in (keyword_matrix.get(key) or [])
                if isinstance(item, dict) and item.get("keyword")
            ]
        ))[:30]
        before = analysis.get("semantic_similarity_before")
        if isinstance(before, dict):
            before = before.get("score")
        after = analysis.get("new_heuristic_score", analysis.get("estimated_score"))
        approval_id = f"HITL-ATS-{uuid.uuid4().hex[:12].upper()}"

        resume_hash = hashlib.sha256(resume_text.encode("utf-8")).hexdigest()
        jd_hash = hashlib.sha256(job_description.encode("utf-8")).hexdigest()
        effective_user_id = user_id or self.user_id

        canonical_data = {
            "approval_id": approval_id,
            "user_id": effective_user_id,
            "resume_hash": resume_hash,
            "jd_hash": jd_hash,
            "extracted_keywords": extracted_keywords,
            "predicted_ats_score_before": before,
            "predicted_ats_score_after": after,
            "optimized_text": analysis.get("optimized_text", ""),
            "optimization_summary": analysis.get("optimization_summary", {}),
            "alignment_report": analysis.get("alignment_report", {}),
        }
        proposal_hash = hashlib.sha256(
            json.dumps(canonical_data, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()

        proposal = {
            "approval_id": approval_id,
            "user_id": effective_user_id,
            "status": "PENDING_USER_APPROVAL",
            "is_sample_data": False,
            "extracted_keywords": extracted_keywords,
            "predicted_ats_score_before": before,
            "predicted_ats_score_after": after,
            "resume_hash": resume_hash,
            "jd_hash": jd_hash,
            "proposal_hash": proposal_hash,
            "resume_preview_with_keywords": analysis.get("optimized_text", ""),
            "optimization_summary": analysis.get("optimization_summary", {}),
            "alignment_report": analysis.get("alignment_report", {}),
        }
        self.pending_hitl_approvals[approval_id] = proposal
        _add_global_approval(approval_id, proposal)

        # Persist to durable shared storage if user is authenticated.
        # The proposal is only returned to the caller after a successful
        # durable write so the route can propagate 503 when persistence is
        # unavailable, rather than handing the caller an untracked approval ID.
        if effective_user_id:
            from app.services.agent_db import create_runtime_approval
            persisted_id = await create_runtime_approval(
                user_id=effective_user_id,
                task_id=None,
                agent_id="autonomous_career_engine",
                tool_name="ats_keyword_optimization",
                tool_input=proposal,
                content_preview=f"ATS Keyword Optimization (Score: {after})",
            )
            if not persisted_id:
                # Remove from in-memory caches to avoid a phantom pending entry.
                self.pending_hitl_approvals.pop(approval_id, None)
                _remove_global_approval(approval_id)
                raise RuntimeError(
                    "Failed to persist HITL approval to durable storage; "
                    "cannot issue a pending proposal."
                )

        return proposal


    async def confirm_ats_keyword_optimization_hitl(
        self,
        approval_id: str,
        approved: bool,
        custom_keywords: Optional[List[str]] = None,
        expected_proposal_hash: Optional[str] = None,
        *,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Accept or reject a real optimizer result after user review, verifying artifact hash binding."""
        effective_user_id = user_id or self.user_id
        item = self.pending_hitl_approvals.get(approval_id)

        if item is None:
            cached = _get_global_approval(approval_id)
            if cached is not None:
                cached_uid = cached.get("user_id")
                if cached_uid == effective_user_id:
                    item = cached

        # Fallback to durable shared storage for replica-safety / LRU eviction recovery
        if item is None and effective_user_id:
            from app.services.agent_db import list_runtime_approvals
            approvals = await list_runtime_approvals(effective_user_id)
            for app in approvals:
                if app.get("tool_name") == "ats_keyword_optimization":
                    t_input = app.get("tool_input")
                    if isinstance(t_input, dict) and t_input.get("approval_id") == approval_id:
                        item = t_input
                        self.pending_hitl_approvals[approval_id] = item
                        _add_global_approval(approval_id, item)
                        break

        if item is None:
            return {"success": False, "error": f"Approval ID '{approval_id}' not found."}
        if item.get("user_id") and effective_user_id and item.get("user_id") != effective_user_id:
            return {"success": False, "error": "Approval belongs to a different user."}
        if item.get("status") != "PENDING_USER_APPROVAL":
            return {"success": False, "error": f"Approval is not in pending state (currently '{item.get('status')}')."}
        if expected_proposal_hash and (
            not item.get("proposal_hash") or expected_proposal_hash != item["proposal_hash"]
        ):
            return {"success": False, "error": "Proposal hash mismatch; proposal has changed."}

        new_status = "APPROVED_AND_READY" if approved else "REJECTED_BY_USER"
        db_status = "approved" if approved else "rejected"

        if effective_user_id:
            from app.services.agent_db import update_runtime_approval
            updated = await update_runtime_approval(
                effective_user_id,
                approval_id,
                db_status,
                "Approved by candidate" if approved else "Rejected by candidate",
            )
            if not updated:
                return {"success": False, "error": "Approval transition failed; record is no longer in pending state or not found."}

        item["status"] = new_status
        # Remove from pending memory caches upon terminal decision
        self.pending_hitl_approvals.pop(approval_id, None)
        _remove_global_approval(approval_id)

        if approved and custom_keywords:
            item["approved_keywords"] = list(dict.fromkeys(custom_keywords))[:30]

        if not approved:
            return {"success": True, "status": "REJECTED_BY_USER", "message": "ATS Optimization cancelled by user."}

        return {
            "success": True,
            "approval_id": approval_id,
            "status": item["status"],
            "proposal_hash": item.get("proposal_hash"),
            "final_keywords": item.get("approved_keywords", item["extracted_keywords"]),
            "final_ats_score": item.get("predicted_ats_score_after"),
            "optimized_text": item.get("resume_preview_with_keywords", ""),
            "message": "Optimized resume approved and ready for download or application review; nothing was submitted.",
        }

    async def universal_batch_auto_apply(
        self,
        job_urls: List[str],
        candidate_profile: Dict[str, Any],
        *,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Prepare bounded application forms for review without submitting them."""
        max_batch_size = 10
        target_urls = job_urls[:max_batch_size]
        application_log = []
        form_filler = FormFiller()
        try:
            for url in target_urls:
                detected_portal = "Universal Platform"
                try:
                    parsed_url = urllib.parse.urlparse(url)
                    netloc = parsed_url.netloc.lower()
                    for domain, portal in PORTAL_DOMAIN_MAP.items():
                        if netloc == domain or netloc.endswith("." + domain):
                            detected_portal = portal
                            break
                except Exception:
                    pass

                tracking_id = f"FORM-PREP-{uuid.uuid4().hex[:12].upper()}"
                try:
                    result = await form_filler.execute_form_auto_fill(
                        url,
                        candidate_profile,
                        user_id=user_id,
                        run_id=tracking_id,
                    )
                    if result.get("success"):
                        status = "FORM_PREPARED"
                    elif result.get("needs_human"):
                        status = "AWAITING_HUMAN_REVIEW"
                    else:
                        status = "FORM_PREPARATION_FAILED"
                    application_log.append({
                        "run_id": tracking_id,
                        "url": url,
                        "portal": detected_portal,
                        "status": status,
                        "submitted": False,
                        "needs_human": bool(result.get("needs_human")),
                        "questions_queued": result.get("questions_queued", 0),
                        "actions_executed": result.get("actions_executed", []),
                        "error": result.get("error"),
                    })
                except Exception as exc:
                    application_log.append({
                        "run_id": tracking_id,
                        "url": url,
                        "portal": detected_portal,
                        "status": "FORM_PREPARATION_FAILED",
                        "submitted": False,
                        "needs_human": True,
                        "questions_queued": 0,
                        "actions_executed": [],
                        "error": str(exc),
                    })
        finally:
            await form_filler.close()

        prepared = sum(1 for item in application_log if item["status"] in {"FORM_PREPARED", "AWAITING_HUMAN_REVIEW"})
        return {
            "total_processed": len(application_log),
            "total_prepared": prepared,
            "submitted": False,
            "portals_covered": sorted({item["portal"] for item in application_log}),
            "all_supported_portals": list(PORTAL_DOMAIN_MAP.values()),
            "applications": application_log,
            "message": "Forms were prepared for human review. No application was submitted.",
        }

    async def generate_ai_salary_negotiation(self, current_offer: int, target_role: str, location: str, company: str) -> Dict[str, Any]:
        """
        AI-Powered Compensation & Counter-Offer Negotiation Engine.
        """
        prompt = f"""You are an executive compensation negotiation advisor.
Analyze the following offer details:
- Role: {target_role}
- Company: {company}
- Location: {location}
- Base Offer: ${current_offer:,}

Provide a compensation strategy and counter-offer recommendation."""

        llm_available = True
        try:
            ai_analysis = await asyncio.wait_for(llm_complete("", prompt), timeout=10.0)
        except LLMNotConfiguredError:
            # ponytail: do not fabricate negotiation output when no LLM is configured;
            # gate derived outputs on llm_available so the API can surface 503.
            llm_available = False
            ai_analysis = None

        if llm_available:
            target_counter = int(current_offer * 1.20)
            script = f"""Dear Hiring Team at {company},

Thank you for extending the offer for the {target_role} position. I am very excited about the team and vision at {company}.

Based on my technical track record in system architecture and market compensation benchmarks for {target_role} roles in {location}, I am seeking a total compensation package of ${target_counter:,}.

If we can align on this target, I am prepared to accept and sign immediately.

Best regards,
Candidate"""
        else:
            target_counter = None
            script = None

        return {
            "company": company,
            "target_role": target_role,
            "current_offer": current_offer,
            "target_counter_offer": target_counter,
            "ai_negotiation_strategy": ai_analysis,
            "llm_available": llm_available,
            "counter_offer_script": script
        }

    async def generate_recruiter_cold_outreach(self, company: str, recruiter_name: str, job_title: str) -> Dict[str, Any]:
        """
        Generate professional recruiter cold email sequence.
        """
        prompt = f"""Draft a short, professional cold outreach email from a job candidate to a recruiter.
- Recruiter: {recruiter_name}
- Company: {company}
- Role: {job_title}

Write only the email body, ready to send."""

        llm_available = True
        try:
            email_1 = await asyncio.wait_for(llm_complete("", prompt), timeout=10.0)
        except LLMNotConfiguredError:
            # ponytail: do not fabricate a "personalized" outreach draft when no
            # LLM is configured; a static template presented as AI-drafted copy
            # is the exact silent-fallback the AI-integrity gate forbids.
            llm_available = False
            email_1 = None

        return {
            "company": company,
            "recruiter": recruiter_name,
            "llm_available": llm_available,
            "sequence": [{"step": "Initial Contact", "email": email_1}] if llm_available else []
        }

    async def generate_interview_copilot_response(self, question: str, role: str) -> Dict[str, Any]:
        """
        Generate STAR-method interview response based on user profile and target role.
        """
        prompt = f"Provide a concise STAR-method answer for the interview question: '{question}' for a candidate applying to role: '{role}'."
        # ponytail: let both LLMNotConfiguredError and any other provider
        # failure (timeout, rate limit, malformed response) propagate to the
        # route unchanged. The route maps LLMNotConfiguredError to 503 and any
        # other exception to a generic 500 — neither path fabricates a STAR
        # answer for a question the model never actually answered.
        star_answer = await asyncio.wait_for(llm_complete("", prompt), timeout=10.0)

        return {
            "question": question,
            "role": role,
            "star_answer": star_answer,
            "star_method_answer": star_answer
        }
