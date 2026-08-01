"""
Truth-Gate Agent — A2A agent wrapper for guardrails & authenticity auditing.
"""
from typing import Dict, Any
from app.a2a.models import AgentCard, AgentCapability, A2AMessage
from app.a2a.registry import AgentRegistry
from app.a2a.dispatcher import A2ADispatcher
from app.guardrails.truth_gate import verify_resume_truthfulness


TRUTH_GATE_AGENT_CARD = AgentCard(
    name="TruthGateAgent",
    description="Audits AI-generated resume rewrites against original text to prevent fabrication or keyword stuffing.",
    version="1.0.0",
    url="http://localhost:8000/a2a/agents/truth-gate",
    capabilities=[
        AgentCapability(
            name="check_authenticity",
            description="Audit original vs optimized text for truthfulness.",
            input_schema={"original_text": "str", "optimized_text": "str"},
            output_schema={"is_truthful": "bool", "risk_score": "int", "flags": "list"},
        )
    ],
)


async def handle_truth_gate_message(message: A2AMessage) -> Dict[str, Any]:
    params = message.params
    original_text = params.get("original_text", "")
    optimized_text = params.get("optimized_text", "")
    res = verify_resume_truthfulness(original_text, optimized_text)
    return {
        "agent": "TruthGateAgent",
        "action": message.method,
        "payload": res.model_dump(),
    }


def register_truth_gate_agent() -> None:
    registry = AgentRegistry.get_instance()
    dispatcher = A2ADispatcher.get_instance()
    registry.register(TRUTH_GATE_AGENT_CARD)
    dispatcher.register_handler("TruthGateAgent", handle_truth_gate_message)
