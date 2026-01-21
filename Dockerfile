# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Run tests
RUN bun run test

# Build the application
RUN bun run build

# Expose the port (Vite preview default)
EXPOSE 4173

# Start the preview server
CMD ["bun", "run", "preview", "--", "--host", "0.0.0.0"]
