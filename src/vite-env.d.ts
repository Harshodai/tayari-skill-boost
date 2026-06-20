/// <reference types="vite/client" />

// Ambient declarations for optional browser extension APIs used in some pages.
declare const chrome: any;
declare const process: { env: Record<string, string | undefined> };
