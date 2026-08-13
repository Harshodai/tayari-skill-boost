import asyncio
import json
import urllib.parse
from typing import Dict, Any, List, Optional
from app.agent.agent_engine import GeneralistAgentEngine
from app.agent.email_connector import EmailConnector
from app.agent.interview_board import InterviewBoardEngine
from app.services.llm_service import llm_complete, LLMNotConfiguredError

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

class AutonomousCareerEngine:
    """
    Executive Career Automation Engine.
    Coordinates local agent tools, email connector parsing, Kanban interview board tracking,
    and compensation strategy templates.
    """

    def __init__(self, workspace_path: str = "./"):
        self.agent = GeneralistAgentEngine(workspace_path=workspace_path)
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

    async def prepare_ats_keyword_optimization_hitl(self, resume_text: str, job_description: str) -> Dict[str, Any]:
        """
        Prepare sample ATS keyword proposal for preview before user review.
        """
        extracted_keywords = [
            'Python', 'System Architecture', 'Kubernetes', 'High Availability',
            'Microservices', 'Distributed Systems', 'PostgreSQL', 'gRPC', 'CI/CD Pipelines'
        ]
        approval_id = f"HITL-ATS-{len(self.pending_hitl_approvals) + 1:04d}"

        proposal = {
            "approval_id": approval_id,
            "status": "PENDING_USER_APPROVAL",
            "is_sample_data": True,
            "extracted_keywords": extracted_keywords,
            "resume_preview_with_keywords": f"{resume_text}\n\n[Candidate Technical Core]: {', '.join(extracted_keywords)}"
        }
        self.pending_hitl_approvals[approval_id] = proposal

        return proposal

    async def confirm_ats_keyword_optimization_hitl(self, approval_id: str, approved: bool, custom_keywords: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Execute or decline the pending HITL keyword optimization based on user decision.
        """
        if approval_id not in self.pending_hitl_approvals:
            return {"success": False, "error": f"Approval ID '{approval_id}' not found."}

        item = self.pending_hitl_approvals[approval_id]
        if not approved:
            item["status"] = "REJECTED_BY_USER"
            return {"success": True, "status": "REJECTED_BY_USER", "message": "ATS Optimization cancelled by user."}

        keywords_to_use = custom_keywords or item["extracted_keywords"]
        item["status"] = "APPROVED_AND_APPLIED"
        item["final_keywords"] = keywords_to_use

        return {
            "success": True,
            "approval_id": approval_id,
            "status": "APPROVED_AND_APPLIED",
            "final_keywords": keywords_to_use
        }

    async def universal_batch_auto_apply(self, job_urls: List[str], candidate_profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Universal Batch Auto-Application for target job URLs.
        """
        max_batch_size = 10
        target_urls = job_urls[:max_batch_size]

        application_log = []
        for idx, url in enumerate(target_urls, 1):
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

            # No click_coordinate is reported. It used to be derived from a
            # hardcoded rectangle, so every row on every portal carried the
            # identical "click coordinate" — a spatial-vision inspection that
            # never happened.
            try:
                nav_res = await self.agent.browser.navigate(url)
                success = nav_res.get("success", False)

                application_log.append({
                    "app_id": f"EXEC-APP-{idx:03d}",
                    "url": url,
                    "portal": detected_portal,
                    "status": "REACHED" if success else "NAVIGATION_FAILED",
                    "hitl_verified": False
                })
            except Exception:
                application_log.append({
                    "app_id": f"EXEC-APP-{idx:03d}",
                    "url": url,
                    "portal": detected_portal,
                    "status": "FAILED",
                    "hitl_verified": False
                })

        # This routine only navigates to each posting — it fills no form and
        # submits nothing — so it reports pages reached, never applications
        # submitted. `total_submitted` is deliberately absent rather than 0:
        # a key that does not exist cannot be rendered as a submission count.
        return {
            "total_processed": len(application_log),
            "total_reached": sum(1 for a in application_log if a["status"] == "REACHED"),
            "submitted": False,
            "portals_covered": list(set(a["portal"] for a in application_log)),
            "all_supported_portals": list(PORTAL_DOMAIN_MAP.values()),
            "applications": application_log
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
        email_1 = f"Subject: {job_title} Application - {company}\n\nDear {recruiter_name},\n\nI recently submitted my application for the {job_title} role at {company}. Having led engineering initiatives in high-scale systems, I would welcome the opportunity to discuss how my experience aligns with your team's goals.\n\nBest regards,\nCandidate"
        return {
            "company": company,
            "recruiter": recruiter_name,
            "sequence": [{"step": "Initial Contact", "email": email_1}]
        }

    async def generate_interview_copilot_response(self, question: str, role: str) -> Dict[str, Any]:
        """
        Generate STAR-method interview response based on user profile and target role.
        """
        prompt = f"Provide a concise STAR-method answer for the interview question: '{question}' for a candidate applying to role: '{role}'."
        try:
            star_answer = await asyncio.wait_for(llm_complete("", prompt), timeout=10.0)
        except LLMNotConfiguredError:
            # ponytail: propagate unavailability unchanged so the route can map it
            # to HTTP 503; never fabricate a STAR answer when no LLM is configured.
            raise
        except Exception:
            star_answer = f"**Situation**: In my recent engineering projects...\n**Task**: Address key challenges for {role}.\n**Action**: Implemented robust architecture and automated testing.\n**Result**: Improved reliability and team velocity."

        return {
            "question": question,
            "role": role,
            "star_answer": star_answer,
            "star_method_answer": star_answer
        }
