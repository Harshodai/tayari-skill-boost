// Global ambient types for optional browser extension / node-like APIs.
export {};

declare global {
  // eslint-disable-next-line no-var
  var chrome: any;
  // eslint-disable-next-line no-var
  var process: { env: Record<string, string | undefined> };
}
