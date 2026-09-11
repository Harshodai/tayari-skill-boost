FROM python:3.11-slim-bookworm

WORKDIR /app

# Install system dependencies for WeasyPrint (fontconfig, pango, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libffi-dev \
    libgdk-pixbuf2.0-0 \
    libxml2 \
    libxslt1.1 \
    shared-mime-info \
    curl \
    xz-utils \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Typst binary for ATS-safe resume PDF export (app/export/typst_exporter.py's
# templates request it by name). Without this, compile_typst_to_pdf() silently
# degrades to a broken plain-text WeasyPrint fallback that still reports
# pdf_available=true (verified live 2026-07-31 — the typst binary was missing
# entirely). Arch-aware: TARGETARCH is set automatically by buildx.
ARG TARGETARCH
RUN TYPST_ARCH=$(if [ "$TARGETARCH" = "arm64" ]; then echo "aarch64"; else echo "x86_64"; fi) \
    && curl -sL "https://github.com/typst/typst/releases/download/v0.15.1/typst-${TYPST_ARCH}-unknown-linux-musl.tar.xz" -o /tmp/typst.tar.xz \
    && tar -xJf /tmp/typst.tar.xz -C /tmp \
    && cp "/tmp/typst-${TYPST_ARCH}-unknown-linux-musl/typst" /usr/local/bin/typst \
    && chmod +x /usr/local/bin/typst \
    && rm -rf /tmp/typst*

COPY requirements.txt .
# ponytail: pip 24.0/setuptools 79.0.1 from the base image carry known CVEs
# (pip-audit, 2026-09-11) — neither is a runtime dependency of the app, but
# both run during every build, so upgrading them costs nothing and closes
# the finding.
RUN pip install --no-cache-dir --upgrade pip setuptools \
    && pip install --no-cache-dir -r requirements.txt

# PLAYWRIGHT_BROWSERS_PATH must be set BEFORE `playwright install` runs —
# `playwright install` downloads browsers to whatever PLAYWRIGHT_BROWSERS_PATH
# resolves to at install time (default ~/.cache/ms-playwright, i.e.
# /root/.cache/ms-playwright while still root). Setting this ENV after install
# (as before) makes the app look for browsers in /app/.cache/ms-playwright at
# runtime while they were actually installed to /root/.cache/ms-playwright —
# every browser-automation call fails with "Executable doesn't exist" at
# runtime, silently, even though the image build reports success. Verified
# live 2026-09-10 via OmniSave/Knowledge Hub save testing.
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.cache/ms-playwright
ENV HOME=/app

# This image runs the FastAPI process directly — /api/v1/browser/automation,
# /api/v1/browser/automation/stream, form_filler.py, and optimizer.py's
# scrape_jd_url all launch Playwright/Chromium inline here (not only via the
# Celery worker, which already had this step in Dockerfile.worker). Without
# it, every one of those routes fails with a missing-executable error the
# first time a request reaches BrowserOperator.initialize().
RUN python -m playwright install --with-deps chromium

# Non-root user for security
RUN groupadd -g 1001 -r app && useradd -r -u 1001 -g app -d /app -s /sbin/nologin app \
    && mkdir -p /app/.cache/ms-playwright /tmp/playwright \
    && chown -R app:app /app /tmp/playwright

COPY --chown=app:app . .

USER app

# --reload starts a file-watching reloader and forces single-process mode —
# right for local dev (this is the compose `dev` profile's default, and the
# image is unchanged for it), wrong for `prod`/`eval`: pure overhead with no
# benefit, and it silently caps the whole service at one worker process.
# UVICORN_RELOAD defaults to the historical "true" so behavior is unchanged
# for anyone not setting it; set UVICORN_RELOAD=false (with UVICORN_WORKERS,
# default 2) for prod/eval via docker-compose.yml's environment block.
CMD ["sh", "-c", "if [ \"${UVICORN_RELOAD:-true}\" = \"true\" ]; then exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload; else exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers \"${UVICORN_WORKERS:-2}\"; fi"]
