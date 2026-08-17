"""Tayari Computer domain contracts and action-policy primitives.

This module intentionally contains no browser or sandbox side effects. It is the
shared validation boundary for local-browser bridge and isolated-computer runs.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ComputerMode(StrEnum):
    ISOLATED = "isolated"
    LOCAL_BROWSER_BRIDGE = "local_browser_bridge"


class ComputerRunState(StrEnum):
    REQUESTED = "requested"
    AWAITING_APPROVAL = "awaiting_approval"
    GRANTED = "granted"
    RUNNING = "running"
    REVOKED = "revoked"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ComputerActionClass(StrEnum):
    READ = "read"
    NAVIGATION = "navigation"
    CANDIDATE_INPUT = "candidate_input"
    SENSITIVE = "sensitive"
    SUBMISSION = "submission"


class ComputerRunPolicy(BaseModel):
    """Server-authored policy; browser content cannot modify it."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    allowed_origins: tuple[str, ...] = ()
    allowed_action_classes: tuple[ComputerActionClass, ...] = (
        ComputerActionClass.READ,
        ComputerActionClass.NAVIGATION,
    )
    max_steps: int = Field(default=25, ge=1, le=100)
    grant_ttl_seconds: int = Field(default=300, ge=30, le=900)
    submission_enabled: bool = False

    @field_validator("allowed_origins")
    @classmethod
    def validate_origins(cls, origins: tuple[str, ...]) -> tuple[str, ...]:
        normalized: list[str] = []
        for origin in origins:
            value = origin.strip().rstrip("/")
            if not value or "://" not in value or any(ch in value for ch in ("\n", "\r", " ")):
                raise ValueError("allowed origins must be absolute, whitespace-free origins")
            if value.lower().startswith(("http://127.", "http://localhost", "http://0.0.0.0")):
                raise ValueError("loopback origins are not valid browser bridge origins")
            normalized.append(value)
        return tuple(dict.fromkeys(normalized))

    @field_validator("submission_enabled")
    @classmethod
    def submission_is_never_implicit(cls, value: bool) -> bool:
        if value:
            raise ValueError("computer submission is disabled by the first-release contract")
        return value


class ComputerRun(BaseModel):
    """Owner- and tenant-bound durable execution identity."""

    model_config = ConfigDict(extra="forbid")

    run_id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    tenant_id: UUID
    mode: ComputerMode
    state: ComputerRunState = ComputerRunState.REQUESTED
    capability: str
    policy: ComputerRunPolicy = Field(default_factory=ComputerRunPolicy)
    provider: str | None = None
    selected_window_id: str | None = Field(default=None, min_length=1, max_length=128)
    selected_tab_id: str | None = Field(default=None, min_length=1, max_length=128)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime | None = None
    revoked_at: datetime | None = None

    @field_validator("capability")
    @classmethod
    def capability_must_be_server_named(cls, value: str) -> str:
        if value not in {
            "workspace.isolated_computer",
            "workspace.local_browser_bridge",
            "workspace.local_browser_sensitive_actions",
        }:
            raise ValueError("unsupported computer capability")
        return value


class ComputerGrant(BaseModel):
    """Short-lived local bridge or provider grant payload."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    grant_id: UUID = Field(default_factory=uuid4)
    run_id: UUID
    user_id: UUID
    tenant_id: UUID
    audience: str = Field(min_length=8, max_length=200)
    nonce: str = Field(min_length=16, max_length=160)
    issued_at: datetime
    expires_at: datetime
    mode: ComputerMode
    capability: str
    policy: ComputerRunPolicy
    key_id: str = Field(min_length=1, max_length=128)

    @field_validator("expires_at")
    @classmethod
    def expiry_after_issue(cls, value: datetime, info):
        issued_at = info.data.get("issued_at")
        if issued_at and value <= issued_at:
            raise ValueError("grant expiry must be after issue time")
        return value


class ComputerObservation(BaseModel):
    """Bounded, redactable observation shared by bridge and isolated modes."""

    model_config = ConfigDict(extra="forbid")

    observation_id: UUID = Field(default_factory=uuid4)
    run_id: UUID
    document_generation: int = Field(ge=0, le=1_000_000)
    origin: str = Field(min_length=8, max_length=2048)
    url: str = Field(min_length=8, max_length=4096)
    accessibility_tree: str = Field(default="", max_length=200_000)
    text_preview: str = Field(default="", max_length=50_000)
    screenshot_sha256: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    content_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    captured_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ComputerActionRequest(BaseModel):
    """Strict action envelope; arbitrary JavaScript and shell are not valid kinds."""

    model_config = ConfigDict(extra="forbid")

    action_id: UUID = Field(default_factory=uuid4)
    run_id: UUID
    grant_id: UUID
    action_class: ComputerActionClass
    kind: Literal["observe", "navigate", "click", "fill", "scroll", "release", "stop"]
    document_generation: int = Field(ge=0, le=1_000_000)
    target_ref: str | None = Field(default=None, max_length=128)
    origin: str = Field(min_length=8, max_length=2048)
    observation_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    params: dict[str, Any] = Field(default_factory=dict)

    @field_validator("params")
    @classmethod
    def reject_privileged_parameters(cls, value: dict[str, Any]) -> dict[str, Any]:
        forbidden = {"cookie", "cookies", "storage", "local_storage", "session_storage", "password", "otp", "mfa", "captcha", "javascript", "shell", "command"}
        lowered = {str(key).lower() for key in value}
        if lowered & forbidden:
            raise ValueError("privileged browser or shell parameters are not allowed")
        return value


def origin_allowed(origin: str, policy: ComputerRunPolicy) -> bool:
    candidate = origin.strip().rstrip("/")
    return bool(candidate) and candidate in policy.allowed_origins


def action_allowed(action: ComputerActionRequest, policy: ComputerRunPolicy) -> bool:
    if action.action_class not in policy.allowed_action_classes:
        return False
    if action.action_class is ComputerActionClass.SUBMISSION:
        return False
    return origin_allowed(action.origin, policy) or action.kind in {"release", "stop"}
