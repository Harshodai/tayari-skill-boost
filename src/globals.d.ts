// Global ambient types for optional browser extension / node-like APIs.
export {};

declare global {
  var chrome: any;
  var process: { env: Record<string, string | undefined> };
}
