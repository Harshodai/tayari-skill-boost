/// <reference types="vite/client" />

// Ambient declarations for optional browser extension APIs used in some pages.
// Wrapped in `declare global` because tsconfig sets `moduleDetection: force`,
// which would otherwise make these declarations file-local.
declare global {
  const chrome: any;
  const process: { env: Record<string, string | undefined> };
}

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_SENTRY_ENVIRONMENT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
