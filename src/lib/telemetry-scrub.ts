// Fields that must never leave the browser as telemetry: resume/JD bodies,
// credentials, and tokens. Sentry's default breadcrumb integration mirrors
// every console.log/warn/error call, so a stray debug log of user content
// would otherwise ride along on the next captured error.
export const SENSITIVE_KEY_PATTERN = /resume|cover.?letter|job.?description|password|token|secret|answer/i;

export function redactSensitiveKeys<T extends Record<string, unknown>>(data: T | undefined): T | undefined {
  if (!data || typeof data !== "object") return data;
  const redacted = { ...data } as Record<string, unknown>;
  for (const key of Object.keys(redacted)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      redacted[key] = "[redacted]";
    }
  }
  return redacted as T;
}

const CONSOLE_BREADCRUMB_MAX_LENGTH = 200;

export function truncateConsoleMessage(message: string): string {
  if (message.length <= CONSOLE_BREADCRUMB_MAX_LENGTH) return message;
  return `${message.slice(0, CONSOLE_BREADCRUMB_MAX_LENGTH)}...[truncated]`;
}
