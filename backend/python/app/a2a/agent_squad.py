"""Candidate-safe multi-agent orchestration for Job Tayari.

This squad deliberately performs only the work implemented by the specialist
agents it calls. It never pretends that a job was found, a browser was opened,
or an application was submitted. A completed squad result is a *reviewable
artifact package*, not permission to take an external action.
"""

from __future__ import annotations

import hashlib
import logging
import os
from typing import Any, Dict
from uuid import uuid4

from app.a2a.agent_audit_trail import AgentAuditTrail
from app.a2a.agents.optimizer_agent import handle_optimizer_message
from app.a2a.agents.truth_gate_agent import handle_truth_gate_message
from app.a2a.models import A2AMessage
from app.services.provenance import ProvenanceError, ProvenanceUnavailable, provenance_service

logger = logging.getLogger(__name__)


class AgentSquadOrchestrator:
    """Runs implemented specialists and produces an auditable review package.

    The squad has two automated stages today: tailoring and truthfulness review.
    Job discovery, browser automation, sensitive-question completion, and final
    submission remain separate, explicitly approved capabilities. Keeping those
    boundaries in the result contract prevents a polished UI from overstating
    what the system actually did.
    """

    def __init__(self, squad_name: str = "JobTayari Review Squad", audit_trail: AgentAuditTrail | None = None):
        self.squad_name = squad_name
        audit_key = os.getenv("AGENT_AUDIT_HMAC_KEY")
        self.audit_trail = audit_trail or AgentAuditTrail(audit_key or "jobtayari-dev-audit-key")

    @staticmethod
    def _fingerprint(value: str) -> str:
        """Fingerprint sensitive artifacts without placing their text in audit metadata."""
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    @staticmethod
    def _message(recipient: str, method: str, params: Dict[str, Any], trace_id: str) -> A2AMessage:
        return A2AMessage(
            sender="JobTayariReviewSquad",
            recipient=recipient,
            method=method,
            params=params,
            trace_id=trace_id,
        )

    async def execute_squad_workflow(
        self,
        resume_text: str,
        jd_text: str,
        company: str = "",
        role: str = "",
        user_id: str | None = None,
    ) -> Dict[str, Any]:
        """Tailor and truth-check a resume as an approval-required workflow.

        The returned ``submission_permitted`` flag is always ``False``. A caller
        must obtain a separately persisted, content-hash-bound candidate approval
        before using any browser-assisted application flow.
        """
        if not resume_text or not resume_text.strip():
            raise ValueError("resume_text is required")
        if not jd_text or not jd_text.strip():
            raise ValueError("jd_text is required")

        trace_id = str(uuid4())
        run_id = str(uuid4())
        metadata = {
            "run_id": run_id,
            "trace_id": trace_id,
            "company": company.strip(),
            "role": role.strip(),
            "resume_sha256": self._fingerprint(resume_text),
            "job_description_sha256": self._fingerprint(jd_text),
        }
        logger.info("Starting review squad run %s for role=%s company=%s", run_id, role, company)

        try:
            optimizer_result = await handle_optimizer_message(
                self._message(
                    "OptimizerAgent",
                    "optimize_resume",
                    {"resume_text": resume_text, "job_description": jd_text},
                    trace_id,
                )
            )
            optimizer_payload = optimizer_result.get("payload", {})
            optimized_text = str(
                optimizer_payload.get("optimized_text")
                or optimizer_payload.get("optimized_resume")
                or optimizer_payload.get("tailored_resume")
                or ""
            )
            if not optimized_text.strip():
                raise RuntimeError("OptimizerAgent returned no reviewable optimized resume")

            self.audit_trail.record_agent_action(
                "OptimizerAgent",
                "optimize_resume",
                metadata,
                {
                    "result": "completed",
                    "optimized_resume_sha256": self._fingerprint(optimized_text),
                    "change_count": len(optimizer_payload.get("changes", [])),
                },
            )

            truth_result = await handle_truth_gate_message(
                self._message(
                    "TruthGateAgent",
                    "check_authenticity",
                    {"original_text": resume_text, "optimized_text": optimized_text},
                    trace_id,
                )
            )
            truth_payload = truth_result.get("payload", {})
            is_truthful = bool(truth_payload.get("is_truthful", False))
            self.audit_trail.record_agent_action(
                "TruthGateAgent",
                "check_authenticity",
                {
                    **metadata,
                    "optimized_resume_sha256": self._fingerprint(optimized_text),
                },
                {
                    "result": "completed",
                    "is_truthful": is_truthful,
                    "risk_score": truth_payload.get("risk_score"),
                    "flag_count": len(truth_payload.get("flags", [])),
                },
                confidence=1.0 if is_truthful else 0.0,
            )
        except Exception as exc:
            logger.exception("Review squad run %s failed", run_id)
            self.audit_trail.record_agent_action(
                "JobTayariReviewSquad",
                "execute_squad_workflow",
                metadata,
                {"result": "failed", "error_type": type(exc).__name__},
                confidence=0.0,
            )
            return {
                "squad_name": self.squad_name,
                "run_id": run_id,
                "trace_id": trace_id,
                "status": "failed",
                "agents_executed": [],
                "message": "The review package could not be produced. No browser session or application action was started.",
                "candidate_approval_required": True,
                "submission_permitted": False,
                "external_submission_verified": False,
                "outputs": {},
            }

        provenance = None
        if user_id:
            try:
                provenance = await provenance_service.create_artifact(
                    user_id=user_id,
                    artifact_type="resume_review_package",
                    content_hash=self._fingerprint(optimized_text),
                    event_type="ai_transformed",
                    origin_actor="ai_system",
                    producer_type="tayari_workflow",
                    idempotency_key=f"agent-squad:{run_id}",
                    metadata={
                        "workflow": "review_squad",
                        "run_id": run_id,
                        "trace_id": trace_id,
                        "company": company.strip(),
                        "role": role.strip(),
                        "candidate_approval_required": True,
                        "submission_permitted": False,
                    },
                    input_hashes=[metadata["resume_sha256"], metadata["job_description_sha256"]],
                    output_hash=self._fingerprint(optimized_text),
                    trace_id=trace_id,
                )
                provenance["disclosure"] = await provenance_service.compute_disclosure(
                    user_id=user_id,
                    artifact_id=provenance["artifact_id"],
                    channel="internal",
                )
            except (ProvenanceUnavailable, ProvenanceError) as exc:
                logger.error("Review squad run %s could not persist provenance: %s", run_id, type(exc).__name__)
                return {
                    "squad_name": self.squad_name,
                    "run_id": run_id,
                    "trace_id": trace_id,
                    "status": "failed",
                    "message": "The review package could not be durably recorded. No browser session or application action was started.",
                    "candidate_approval_required": True,
                    "submission_permitted": False,
                    "external_submission_verified": False,
                    "provenance_persisted": False,
                    "outputs": {},
                }

        return {
            "squad_name": self.squad_name,
            "run_id": run_id,
            "trace_id": trace_id,
            "status": "completed",
            "agents_executed": ["OptimizerAgent", "TruthGateAgent"],
            "message": "A reviewable tailored-resume package is ready. Candidate approval is required before any downstream action.",
            "candidate_approval_required": True,
            "approval_scope": {
                "resume_sha256": self._fingerprint(optimized_text),
                "job_description_sha256": metadata["job_description_sha256"],
                "invalidated_when": ["resume changes", "job description changes", "candidate edits an answer"],
            },
            "submission_permitted": False,
            "external_submission_verified": False,
            "provenance_persisted": bool(provenance) if user_id else None,
            "provenance": provenance,
            "next_action": "Show the candidate the optimized resume and truth-gate flags, then request a content-hash-bound approval.",
            "outputs": {
                "optimizer": optimizer_payload,
                "truth_gate": truth_payload,
            },
            "audit_events": self.audit_trail.get_logs(),
        }
