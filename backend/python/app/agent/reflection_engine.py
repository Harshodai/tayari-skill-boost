import re
from typing import Dict, Any, Optional

IDENTIFIER_REGEX = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

class ReflectionEngine:
    """
    Self-Correction & Reflection Engine.
    Implements self-debugging loops for AI agents.
    Parses code tracebacks, diagnoses failure causes, formulates fix hypotheses,
    and automatically patch code actions.
    """

    def analyze_failure(self, code: str, error_msg: str, attempt: int = 1) -> Dict[str, Any]:
        """
        Analyze execution failure and produce a fix hypothesis and auto-patched code snippet.
        """
        diagnosis = "Unknown Execution Error"
        fix_hypothesis = "Review error message and adjust parameters."
        patched_code = code
        actionable_patch = False

        if "ModuleNotFoundError" in error_msg:
            missing_module = re.search(r"No module named '([^']+)'", error_msg)
            mod_name = missing_module.group(1) if missing_module else ""
            if mod_name and IDENTIFIER_REGEX.match(mod_name):
                diagnosis = f"Missing Python dependency: {mod_name}"
                fix_hypothesis = f"Wrap import of '{mod_name}' in try/except fallback or use built-in standard libraries."
                patched_code = f"# Patched for missing module '{mod_name}'\ntry:\n    import {mod_name}\nexcept ImportError:\n    pass\n" + code
                actionable_patch = True
            else:
                diagnosis = "Missing unknown Python dependency"

        elif "FileNotFoundError" in error_msg:
            file_match = re.search(r"No such file or directory: '([^']+)'", error_msg)
            target_path = file_match.group(1) if file_match else ""
            diagnosis = "Target file or directory does not exist in workspace."
            fix_hypothesis = "Ensure parent directory exists using os.makedirs before file operations."
            if target_path:
                patched_code = f"import os\nos.makedirs(os.path.dirname({repr(target_path)}), exist_ok=True)\n" + code
            else:
                patched_code = f"import os\nos.makedirs('.', exist_ok=True)\n" + code
            actionable_patch = True

        elif "NameError" in error_msg:
            var_match = re.search(r"name '([^']+)' is not defined", error_msg)
            var_name = var_match.group(1) if var_match else ""
            if var_name and IDENTIFIER_REGEX.match(var_name):
                diagnosis = f"Undefined variable: '{var_name}'"
                fix_hypothesis = f"Initialize variable '{var_name}' before dereferencing."
                patched_code = f"{var_name} = None\n" + code
                actionable_patch = True
            else:
                diagnosis = "Undefined variable error"

        elif "SyntaxError" in error_msg:
            diagnosis = "Python code syntax error."
            fix_hypothesis = "Format code block with correct indentation and syntax."
            actionable_patch = False

        elif "TimeoutError" in error_msg:
            diagnosis = "Execution time limit exceeded."
            fix_hypothesis = "Optimize loops, reduce iteration count, or use async non-blocking operations."
            actionable_patch = False

        return {
            "attempt": attempt,
            "error_summary": error_msg.splitlines()[-1] if error_msg else error_msg,
            "diagnosis": diagnosis,
            "hypothesis": fix_hypothesis,
            "original_code": code,
            "patched_code": patched_code,
            "actionable_patch": actionable_patch
        }
