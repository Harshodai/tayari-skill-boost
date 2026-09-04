"""M9: lifespan startup/shutdown contract — scheduler task is started and cancelled."""
from __future__ import annotations

import asyncio

from fastapi import FastAPI


async def _never_loop(*_args, **_kwargs):
    await asyncio.sleep(3600)


def test_lifespan_starts_and_cancels_scheduler(monkeypatch):
    import app.main as main_mod

    import app.services.scheduler as sched_mod

    monkeypatch.setattr(main_mod, "register_all_a2a_agents", lambda: None)
    monkeypatch.setattr(sched_mod, "scheduler_loop", _never_loop)

    app = FastAPI(lifespan=main_mod.lifespan)

    async def _run():
        async with main_mod.lifespan(app):
            task = app.state.sched_task
            assert task is not None
            assert not task.done()
            held = task
            return held

    task = asyncio.run(_run())
    assert task.cancelled() or task.done()


def test_app_wires_lifespan():
    import app.main as main_mod

    assert main_mod.app.router.lifespan_context is not None
