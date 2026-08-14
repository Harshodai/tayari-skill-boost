# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Run tests
RUN bun run test

# Build args
ARG VITE_API_URL=/api
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_USE_SELF_HOSTED=false
ARG VITE_SUPABASE_PROJECT_ID

# Fail closed: an empty auth configuration produces a broken production bundle.
RUN test -n "$VITE_SUPABASE_URL" || (echo "VITE_SUPABASE_URL is required for release builds" >&2; exit 1) \
    && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" || (echo "VITE_SUPABASE_PUBLISHABLE_KEY is required for release builds" >&2; exit 1)

# Set as env vars for build time
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_USE_SELF_HOSTED=$VITE_USE_SELF_HOSTED
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

# Build the application
RUN bun run build

# Expose the port (Vite preview default)
EXPOSE 4173

# Start the preview server
CMD ["bun", "run", "preview", "--", "--host", "0.0.0.0"]
