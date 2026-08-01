"""
Pydantic v2 Models for Agent-to-Agent (A2A) Protocol Specification.
Compliant with Linux Foundation A2A Open Architecture.
"""
from typing import List, Optional, Dict, Any, Union, Literal
from datetime import datetime
from uuid import uuid4
from pydantic import BaseModel, Field, ConfigDict


class AgentCapability(BaseModel):
    """Declaration of a single agent capability."""
    model_config = ConfigDict(extra="forbid")
    name: str
    description: str
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    output_schema: Dict[str, Any] = Field(default_factory=dict)


class AgentCard(BaseModel):
    """Agent discovery card served at /.well-known/agent-card.json."""
    model_config = ConfigDict(extra="forbid")
    name: str
    description: str
    version: str = "1.0.0"
    url: str
    capabilities: List[AgentCapability] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TextPart(BaseModel):
    kind: Literal["text"] = "text"
    text: str


class DataPart(BaseModel):
    kind: Literal["data"] = "data"
    data: Dict[str, Any]


Part = Union[TextPart, DataPart]


class Artifact(BaseModel):
    """Structured output produced by an agent execution."""
    model_config = ConfigDict(extra="forbid")
    artifact_id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    mime_type: str = "application/json"
    data: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class Task(BaseModel):
    """Standardized task delegated between agents."""
    model_config = ConfigDict(extra="forbid")
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    input_data: Dict[str, Any] = Field(default_factory=dict)
    artifacts: List[Artifact] = Field(default_factory=list)
    error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    completed_at: Optional[str] = None


class A2AMessage(BaseModel):
    """JSON-RPC 2.0 compliant A2A Message Envelope."""
    model_config = ConfigDict(extra="forbid")
    jsonrpc: str = "2.0"
    id: str = Field(default_factory=lambda: str(uuid4()))
    sender: str
    recipient: str
    method: str  # e.g., "task.delegate", "task.status", "agent.capability"
    params: Dict[str, Any] = Field(default_factory=dict)
    trace_id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class A2AResponse(BaseModel):
    """Standardized A2A response payload."""
    model_config = ConfigDict(extra="forbid")
    jsonrpc: str = "2.0"
    id: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    trace_id: str
