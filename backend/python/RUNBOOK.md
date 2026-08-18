# Local Python Runbook

The project requires Python 3.11+. The macOS system `python3` is 3.9 and will fail with `TypeError: unsupported operand type(s) for |: 'type' and 'type'`.

Always use the committed virtual environment:

```bash
cd backend/python
.venv/bin/python -m pytest app/tests tests -q
.venv/bin/python scripts/verify_production_truth_contract.py
```
