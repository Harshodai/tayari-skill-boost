"""Opt-in Docker runtime for computer runs (P7).

Default OFF: COMPUTER_RUNTIME=inprocess runs Playwright in-process via
BrowserWorker with zero behavior change. COMPUTER_RUNTIME=docker selects
per-run container isolation on a bigger host.

Fail-closed: when the docker CLI is missing or unusable, raise
ComputerRuntimeUnavailable. NEVER silently fall back to inprocess —
explicitness beats availability for an isolation boundary.
# ponytail: on that choice.
"""

from __future__ import annotations

import os
import re
import subprocess

DEFAULT_DOCKER_IMAGE = "mcr.microsoft.com/playwright/python:v1.49.1"
DEFAULT_MEMORY = "2g"
DEFAULT_CPUS = "2"


class ComputerRuntimeUnavailable(RuntimeError):
    """Raised when the docker runtime was requested but cannot run."""


def get_computer_runtime() -> str:
    return (os.getenv("COMPUTER_RUNTIME", "inprocess") or "inprocess").strip().lower() or "inprocess"


def get_computer_docker_image() -> str:
    return (os.getenv("COMPUTER_DOCKER_IMAGE", "") or "").strip() or DEFAULT_DOCKER_IMAGE


def container_name(run_id: str) -> str:
    # ponytail: run_id reaches argv — allowlist to [A-Za-z0-9_.-] so a hostile id can't reshape the command
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", str(run_id).strip()) or "unknown"
    return f"tayari-computer-{safe}"


def get_computer_docker_network() -> str:
    return (os.getenv("COMPUTER_DOCKER_NETWORK", "") or "").strip() or "bridge"


class DockerRunner:
    def __init__(self, image: str | None = None):
        self.image = (image or "").strip() or get_computer_docker_image()

    def start(self, run_id: str, target_url: str, user_id: str) -> str:
        from app.services.browser_worker_pool import validate_ats_url

        validate_ats_url(target_url)
        name = container_name(run_id)
        network = get_computer_docker_network()
        argv = [
            "docker", "run", "-d", "--rm",
            f"--memory={DEFAULT_MEMORY}",
            f"--cpus={DEFAULT_CPUS}",
            "--network", network,
            "-e", f"TAYARI_TARGET_URL={target_url}",
            "-e", f"TAYARI_USER_ID={user_id}",
            "--name", name,
            self.image,
        ]
        try:
            result = subprocess.run(argv, capture_output=True, text=True, timeout=30)
        except FileNotFoundError as exc:
            raise ComputerRuntimeUnavailable("docker CLI not available") from exc
        if result.returncode != 0:
            raise ComputerRuntimeUnavailable(f"docker run failed: {result.stderr or result.returncode}")
        container_id = (result.stdout or "").strip()
        return container_id or name

    def stop(self, run_id: str, timeout: int = 5) -> bool:
        name = container_name(run_id)
        try:
            result = subprocess.run(
                ["docker", "rm", "-f", name],
                capture_output=True, text=True, timeout=timeout,
            )
        except FileNotFoundError as exc:
            raise ComputerRuntimeUnavailable("docker CLI not available") from exc
        if result.returncode != 0:
            raise ComputerRuntimeUnavailable(f"docker rm failed: {result.stderr or result.returncode}")
        return True
