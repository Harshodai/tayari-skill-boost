"""Opt-in Docker runtime for computer runs (P7).

RED-first TDD: DockerRunner via docker CLI + subprocess only, fail-closed.
"""
import subprocess

import pytest

GOOD_URL = "https://boards.greenhouse.io/acme/jobs/12345"
BAD_URL = "https://evil.com/phish"


def test_default_runtime_is_inprocess(monkeypatch):
    monkeypatch.delenv("COMPUTER_RUNTIME", raising=False)
    from app.services import computer_docker_runtime as cdr

    assert cdr.get_computer_runtime() == "inprocess"


def test_start_builds_correct_argv(monkeypatch):
    monkeypatch.setenv("COMPUTER_RUNTIME", "docker")
    monkeypatch.delenv("COMPUTER_DOCKER_IMAGE", raising=False)
    from app.services import computer_docker_runtime as cdr

    calls = []

    class _Result:
        returncode = 0
        stdout = "abc123\n"

    def _fake_run(argv, **kwargs):
        calls.append(argv)
        return _Result()

    monkeypatch.setattr(subprocess, "run", _fake_run)
    runner = cdr.DockerRunner()
    runner.start("run-1", GOOD_URL, "user-1")
    assert calls, "expected one docker call"
    argv = calls[0]
    assert argv[:6] == ["docker", "run", "-d", "--rm", "--memory=2g", "--cpus=2"]
    assert "--name" in argv
    assert "tayari-computer-run-1" in argv
    assert "mcr.microsoft.com/playwright/python:v1.49.1" in argv


def test_start_validates_bad_url_before_docker(monkeypatch):
    from app.services import computer_docker_runtime as cdr
    from app.services.browser_worker_pool import DomainForbiddenError

    def _boom(argv, **kwargs):
        raise AssertionError("docker must not be called for a forbidden URL")

    monkeypatch.setattr(subprocess, "run", _boom)
    runner = cdr.DockerRunner()
    with pytest.raises(DomainForbiddenError):
        runner.start("run-1", BAD_URL, "user-1")


def test_stop_issues_rm_f(monkeypatch):
    from app.services import computer_docker_runtime as cdr

    calls = []

    class _Result:
        returncode = 0
        stdout = ""

    def _fake_run(argv, **kwargs):
        calls.append(argv)
        return _Result()

    monkeypatch.setattr(subprocess, "run", _fake_run)
    runner = cdr.DockerRunner()
    runner.stop("run-1")
    assert calls == [["docker", "rm", "-f", "tayari-computer-run-1"]]


def test_missing_docker_cli_raises_fail_closed(monkeypatch):
    from app.services import computer_docker_runtime as cdr

    def _missing(argv, **kwargs):
        raise FileNotFoundError("docker")

    monkeypatch.setattr(subprocess, "run", _missing)
    runner = cdr.DockerRunner()
    with pytest.raises(cdr.ComputerRuntimeUnavailable):
        runner.start("run-1", GOOD_URL, "user-1")
    with pytest.raises(cdr.ComputerRuntimeUnavailable):
        runner.stop("run-1")


def test_default_flag_inprocess_never_touches_subprocess(monkeypatch):
    monkeypatch.delenv("COMPUTER_RUNTIME", raising=False)
    from app.services import computer_docker_runtime as cdr

    def _boom(argv, **kwargs):
        raise AssertionError("inprocess path must never touch subprocess")

    monkeypatch.setattr(subprocess, "run", _boom)
    assert cdr.get_computer_runtime() == "inprocess"


def test_browser_worker_default_runtime_unchanged(monkeypatch):
    monkeypatch.delenv("COMPUTER_RUNTIME", raising=False)

    def _boom(argv, **kwargs):
        raise AssertionError("default BrowserWorker must never touch subprocess")

    monkeypatch.setattr(subprocess, "run", _boom)
    from app.services.browser_worker_pool import BrowserWorker

    worker = BrowserWorker(run_id="r1", user_id="u1", target_url=GOOD_URL)
    assert worker.runtime == "inprocess"


def test_container_name_sanitizes_hostile_run_id():
    from app.services import computer_docker_runtime as cdr

    assert cdr.container_name("r1") == "tayari-computer-r1"
    assert cdr.container_name("a;b $(x) `y`") == "tayari-computer-a_b___x___y_"
    assert " " not in cdr.container_name("a b;c") and ";" not in cdr.container_name("a b;c")


def test_start_uses_network_env_and_returns_container_id(monkeypatch):
    import subprocess
    from app.services import computer_docker_runtime as cdr

    monkeypatch.setenv("COMPUTER_DOCKER_NETWORK", "tayari-net")
    calls = []

    class _Result:
        returncode = 0
        stdout = "deadbeef1234\n"
        stderr = ""

    def _fake_run(argv, **kwargs):
        calls.append(argv)
        return _Result()

    monkeypatch.setattr(subprocess, "run", _fake_run)
    runner = cdr.DockerRunner()
    cid = runner.start("run-1", GOOD_URL, "user-1")
    assert cid == "deadbeef1234"
    argv = calls[0]
    assert "--network" in argv and "tayari-net" in argv
    env_vals = [argv[i + 1] for i, a in enumerate(argv) if a == "-e"]
    assert any(GOOD_URL in v for v in env_vals)
    assert any("user-1" in v for v in env_vals)


def test_start_defaults_network_to_bridge_and_falls_back_to_name(monkeypatch):
    import subprocess
    from app.services import computer_docker_runtime as cdr

    monkeypatch.delenv("COMPUTER_DOCKER_NETWORK", raising=False)
    assert cdr.get_computer_docker_network() == "bridge"

    class _Result:
        returncode = 0
        stdout = "\n"
        stderr = ""

    def _fake_run(argv, **kwargs):
        assert "--network" in argv and "bridge" in argv
        return _Result()

    monkeypatch.setattr(subprocess, "run", _fake_run)
    runner = cdr.DockerRunner()
    assert runner.start("run-1", GOOD_URL, "user-1") == "tayari-computer-run-1"
