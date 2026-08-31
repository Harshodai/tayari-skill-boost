import os
import pytest
from app.agent.codeact_repl import CodeActREPL

@pytest.mark.asyncio
async def test_codeact_infinite_loop_timeout_kills_process():
    repl = CodeActREPL()
    # CodeAct snippet with a tight CPU-bound infinite loop
    code = "while True:\n    pass"
    res = await repl.execute(code, timeout=0.5)
    assert res["success"] is False
    assert res.get("timed_out") is True
    assert "TimeoutError" in res["error"]

@pytest.mark.asyncio
async def test_codeact_cannot_access_host_secrets(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "super_secret_jwt_key_12345")
    monkeypatch.setenv("DATABASE_URL", "postgres://admin:secret_pass@localhost:5432/db")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "secret_supabase_service_role")
    
    repl = CodeActREPL()
    code = """
import os
jwt = os.environ.get('JWT_SECRET', '')
db = os.environ.get('DATABASE_URL', '')
sb = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
print(f"FOUND_SECRETS:{jwt}:{db}:{sb}")
"""
    res = await repl.execute(code, timeout=5.0)
    assert res["success"] is True
    assert "FOUND_SECRETS:::" in res["stdout"]
    assert "super_secret" not in res["stdout"]

@pytest.mark.asyncio
async def test_codeact_bounded_output_ceiling():
    repl = CodeActREPL()
    # Output generator trying to produce 1MB of text
    code = "print('A' * 200000)"
    res = await repl.execute(code, timeout=5.0)
    assert res["success"] is True
    assert len(res["stdout"]) <= 65536
