import os
import sys
import signal
import asyncio
import logging
import tempfile
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

_repl_locks: Dict[Any, asyncio.Lock] = {}

def _get_repl_lock() -> asyncio.Lock:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop not in _repl_locks:
        _repl_locks[loop] = asyncio.Lock()
    return _repl_locks[loop]

_RUNNER_SCRIPT = r"""
import sys
import traceback

code = sys.stdin.read()
is_eval = True
try:
    compiled = compile(code, "<codeact_repl>", "eval")
except SyntaxError:
    is_eval = False
    try:
        compiled = compile(code, "<codeact_repl>", "exec")
    except Exception as exc:
        sys.stderr.write(f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}")
        sys.exit(1)

try:
    if is_eval:
        result = eval(compiled, globals())
        if result is not None:
            print(repr(result))
    else:
        exec(compiled, globals())
except Exception as exc:
    sys.stderr.write(f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}")
    sys.exit(1)
"""

MAX_OUTPUT_BYTES = 64 * 1024  # 64 KiB stdout/stderr output ceiling

SAFE_ENV_ALLOWLIST = frozenset({
    "PATH", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TEMP", "TMP", "PYTHONHOME",
})


def _build_safe_env() -> Dict[str, str]:
    """Return a sanitized environment containing zero production secrets."""
    safe_env: Dict[str, str] = {}
    for key in SAFE_ENV_ALLOWLIST:
        val = os.environ.get(key)
        if val is not None:
            safe_env[key] = val
    if "PATH" not in safe_env:
        safe_env["PATH"] = "/usr/local/bin:/usr/bin:/bin"
    # Ensure subprocess cannot access production environment secrets
    safe_env["APP_ENV"] = "sandbox"
    safe_env["PYTHONUNBUFFERED"] = "1"
    return safe_env


def _sandbox_preexec(timeout_seconds: float):
    """Apply OS-level execution constraints to the subprocess.

    Session leadership is now set via start_new_session=True on
    create_subprocess_exec, so os.setsid() is NOT called here.
    """
    import resource as _resource

    def _apply(name: str, soft: int, hard: int) -> None:
        """Apply a single rlimit, logging on failure so missing limits are visible."""
        limit = getattr(_resource, name, None)
        if limit is None:
            return
        try:
            _resource.setrlimit(limit, (soft, hard))
        except (ValueError, OSError) as exc:
            import sys as _sys
            print(f"[codeact_repl] WARNING: setrlimit({name}, ({soft}, {hard})) failed: {exc}", file=_sys.stderr)

    # CPU time — derived from the wall-clock timeout so the hard cap tracks the
    # actual budget; +5 s grace period allows orderly cleanup before SIGKILL.
    cpu_soft = max(1, int(timeout_seconds))
    cpu_hard = cpu_soft + 5
    _apply("RLIMIT_CPU", cpu_soft, cpu_hard)

    # File creation size (10 MiB)
    _apply("RLIMIT_FSIZE", 10 * 1024 * 1024, 10 * 1024 * 1024)

    # Address-space (virtual memory) limit — 512 MiB prevents runaway memory
    # growth and OOM-killer surprises for neighbouring processes.
    _MiB_512 = 512 * 1024 * 1024
    _apply("RLIMIT_AS", _MiB_512, _MiB_512)

    # Open file-descriptor count
    _apply("RLIMIT_NOFILE", 128, 128)



async def _read_bounded(stream: asyncio.StreamReader, max_bytes: int) -> bytes:
    """Read stream incrementally up to max_bytes, continuing to drain remaining stream to avoid pipe blocks."""
    buf = bytearray()
    while True:
        chunk = await stream.read(4096)
        if not chunk:
            break
        if len(buf) < max_bytes:
            remaining = max_bytes - len(buf)
            buf.extend(chunk[:remaining])
    return bytes(buf)


class CodeActREPL:
    """
    Isolated Subprocess Code Actions (CodeAct) Python REPL.

    Executes Python snippets in an ephemeral, isolated subprocess boundary:
    1. Zero access to production secrets (sanitized environment).
    2. Bounded execution with strict wall-clock timeout and hard process kill.
    3. Dedicated workspace cwd.
    4. Bounded stdout/stderr capture with active stream draining to prevent memory exhaustion.
    5. OS-level resource limits on CPU time, file size, and open descriptors.
    """

    def __init__(self, workspace_path: str = "./", user_id: Optional[str] = None):
        self.workspace_path = workspace_path
        self.user_id = user_id
        self.history: List[Dict[str, Any]] = []

    async def execute(self, code: str, timeout: float = 30.0) -> Dict[str, Any]:
        """
        Execute a bounded CodeAct snippet in an isolated subprocess.

        Production deployments must explicitly opt in with ``ENABLE_CODEACT=true``.
        The default remains available for unit tests and local development only.
        """
        if os.getenv("APP_ENV", "development").lower() == "production" and os.getenv("ENABLE_CODEACT", "false").lower() != "true":
            return {
                "success": False,
                "stdout": "",
                "stderr": "",
                "error": "CodeAct is disabled in production unless ENABLE_CODEACT=true.",
                "code": code,
            }

        async with _get_repl_lock():
            env = _build_safe_env()
            cwd = self.workspace_path if os.path.exists(self.workspace_path) else tempfile.gettempdir()

            proc = None
            try:
                # start_new_session=True places the child in its own session and
                # process group, replacing the os.setsid() call that was previously
                # in _sandbox_preexec. This is the asyncio-safe approach; preexec_fn
                # cannot be used reliably with asyncio on all platforms.
                proc = await asyncio.create_subprocess_exec(
                    sys.executable,
                    "-u",
                    "-c",
                    _RUNNER_SCRIPT,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=cwd,
                    env=env,
                    start_new_session=True,
                    preexec_fn=lambda: _sandbox_preexec(timeout),
                )

                if proc.stdin:
                    proc.stdin.write(code.encode("utf-8"))
                    await proc.stdin.drain()
                    proc.stdin.close()

                try:
                    stdout_bytes, stderr_bytes, _ = await asyncio.wait_for(
                        asyncio.gather(
                            _read_bounded(proc.stdout, MAX_OUTPUT_BYTES),
                            _read_bounded(proc.stderr, MAX_OUTPUT_BYTES),
                            proc.wait(),
                        ),
                        timeout=timeout,
                    )
                except asyncio.TimeoutError:
                    # Process did not exit within timeout: hard kill process group.
                    # Guard: only send SIGKILL to the child's process group when it
                    # differs from our own group to avoid accidentally killing the
                    # parent process or sibling workers.
                    if proc and proc.pid:
                        try:
                            child_pgid = os.getpgid(proc.pid)
                            if child_pgid != os.getpgid(os.getpid()):
                                os.killpg(child_pgid, signal.SIGKILL)
                            else:
                                proc.kill()
                        except (ProcessLookupError, OSError):
                            try:
                                proc.kill()
                            except ProcessLookupError:
                                pass
                    try:
                        await proc.wait()
                    except Exception:
                        pass

                    err_msg = f"TimeoutError: Code execution exceeded maximum allotted time of {timeout} seconds."
                    output = {
                        "success": False,
                        "stdout": "",
                        "stderr": err_msg,
                        "error": err_msg,
                        "code": code,
                        "timed_out": True,
                    }
                    self.history.append(output)
                    return output

                stdout_str = stdout_bytes.decode("utf-8", errors="replace")
                stderr_str = stderr_bytes.decode("utf-8", errors="replace")
                success = (proc.returncode == 0)

                # When exit is non-zero but stderr is empty (e.g. SIGKILL from
                # RLIMIT_CPU, OOM killer, or OS-level abort), synthesize a
                # diagnostic so callers receive a meaningful error string rather
                # than an empty "error" field.
                if not success and not stderr_str.strip():
                    stderr_str = (
                        f"ProcessError: subprocess exited with code {proc.returncode} "
                        f"(possibly terminated by signal or OS resource limit)."
                    )

                output = {
                    "success": success,
                    "stdout": stdout_str,
                    "stderr": stderr_str,
                    "error": stderr_str if not success else None,
                    "code": code,
                }
                self.history.append(output)
                return output

            except Exception as exc:
                if proc and proc.pid:
                    try:
                        proc.kill()
                    except ProcessLookupError:
                        pass
                err_msg = f"ExecutionFailure: {type(exc).__name__}: {exc}"
                output = {
                    "success": False,
                    "stdout": "",
                    "stderr": err_msg,
                    "error": err_msg,
                    "code": code,
                }
                self.history.append(output)
                return output

