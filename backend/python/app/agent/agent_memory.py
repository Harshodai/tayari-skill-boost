import time
from typing import Dict, Any, List, Optional

class AgentMemory:
    """
    Episodic & Semantic Memory Store for Generalist AI Agents.
    Maintains short-term execution scratchpad, action-observation history,
    and in-memory session-scoped key-value knowledge retention.
    """

    def __init__(self):
        self.episodic_memory: List[Dict[str, Any]] = []
        self.semantic_memory: Dict[str, Any] = {}
        self.reflections: List[Dict[str, Any]] = []

    def record_episode(self, step: int, action: str, code: Optional[str], result: Any, success: bool):
        """Record an execution step into episodic memory."""
        episode = {
            "step": step,
            "timestamp": time.time(),
            "action": action,
            "code": code,
            "result": result,
            "success": success
        }
        self.episodic_memory.append(episode)

    def record_reflection(self, step: int, error: str, hypothesis: str, correction: str):
        """Record a self-correction reflection into memory."""
        reflection = {
            "step": step,
            "timestamp": time.time(),
            "error": error,
            "hypothesis": hypothesis,
            "correction": correction
        }
        self.reflections.append(reflection)

    def store_knowledge(self, key: str, value: Any):
        """Store persistent semantic knowledge."""
        self.semantic_memory[key] = value

    def recall_knowledge(self, key: str) -> Optional[Any]:
        """Recall persistent semantic knowledge."""
        return self.semantic_memory.get(key)

    def get_summary(self) -> Dict[str, Any]:
        """Get condensed summary of agent memory for prompt context injection."""
        return {
            "total_episodes": len(self.episodic_memory),
            "successful_episodes": len([e for e in self.episodic_memory if e["success"]]),
            "failed_episodes": len([e for e in self.episodic_memory if not e["success"]]),
            "total_reflections": len(self.reflections),
            "semantic_keys": list(self.semantic_memory.keys())
        }
