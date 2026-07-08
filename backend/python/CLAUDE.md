# Python AI engine (FastAPI)

Stateless LLM/ML layer called by the Go backend.

# Rules here
- Run `python -m py_compile` on new/changed files before committing — AGENT_SPEC.md makes this a required validation gate.
- `pytest` and `pyyaml` are NOT in `requirements.txt`; install them separately to run the eval suite (`python -m pytest eval/runner.py -v`).
- Plugins under `app/plugins/resume_optimizer/` are auto-discovered — add a module, don't wire it up by hand.
