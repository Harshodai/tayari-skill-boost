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
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
