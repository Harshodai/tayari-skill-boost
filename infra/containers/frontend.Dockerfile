# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json bun.lockb ./
RUN corepack enable && bun install --frozen-lockfile

COPY . .

ARG VITE_API_URL=/api
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_USE_SELF_HOSTED=false
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT=production

RUN test -n "$VITE_SUPABASE_URL" || (echo "VITE_SUPABASE_URL is required for release builds" >&2; exit 1) \
    && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" || (echo "VITE_SUPABASE_PUBLISHABLE_KEY is required for release builds" >&2; exit 1)

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY} \
    VITE_USE_SELF_HOSTED=${VITE_USE_SELF_HOSTED} \
    VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID} \
    VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
    VITE_SENTRY_ENVIRONMENT=${VITE_SENTRY_ENVIRONMENT}

RUN bun run build

FROM nginx:1.27-alpine

RUN addgroup -S app && adduser -S -G app app \
    && mkdir -p /var/cache/nginx /var/run /var/log/nginx \
    && chown -R app:app /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html

COPY infra/containers/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=app:app /app/dist /usr/share/nginx/html

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
