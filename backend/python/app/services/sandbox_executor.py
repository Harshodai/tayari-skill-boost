"""Deprecated shim — this module was never a sandbox (WS-06).

Real per-run isolation now lives in
``app.services.browser_automation.session``. The form-filling logic moved to
``app.services.form_filler``. This shim keeps existing imports working and
will be removed once callers are migrated.
"""
from __future__ import annotations

import warnings

from app.services.form_filler import *  # noqa: F401,F403
from app.services.form_filler import (  # noqa: F401
    FormFiller,
    FormFiller as TayariComputerSandboxExecutor,
    _resolve_and_validate_url,
)

warnings.warn(
    "app.services.sandbox_executor is deprecated; import app.services.form_filler instead.",
    DeprecationWarning,
    stacklevel=2,
)
