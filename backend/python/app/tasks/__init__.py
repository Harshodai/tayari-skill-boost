"""Celery task modules for Tayari.

- :mod:`app.tasks.scraping`  - ``hermes.scrape_job_board``
- :mod:`app.tasks.automation` - ``autopilot.run_application_agent``,
  ``autopilot.run_scheduled``

Imported by ``app.celery_app`` via ``include`` so the worker registers them.
"""