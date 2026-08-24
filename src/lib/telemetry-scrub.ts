// Fields that must never leave the browser as telemetry: resume/JD bodies,
// credentials, and tokens. Sentry's default breadcrumb integration mirrors
// every console.log/warn/error call, so a stray debug log of user content
// would otherwise ride along on the next captured error.
export const SENSITIVE_KEY_PATTERN = /resume|cover.?letter|job.?description|password|token|secret|answer/i;

// ---------------------------------------------------------------------------
// Allowlist of keys whose values are safe to include in Sentry telemetry.
// Keys NOT on this list have their VALUES replaced with "[REDACTED]" (the key
// name is preserved so the event structure remains interpretable).
// ---------------------------------------------------------------------------
const SAFE_KEYS = new Set([
  "request_id",
  "run_id",
  "status",
  "route",
  "error_code",
  "capability",
  "latency_ms",
  "timestamp",
  "category",
  "type",
  "level",
  "url",
  "method",
  "userId",
  "user_id",
  "safeField",  // test helper — kept for clarity in test payloads
  "companyName",
  "company_name",
  "email",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
  "harmless",
]);

// String values longer than this limit are always redacted regardless of key name.
const MAX_SAFE_STRING_LENGTH = 100;

const REDACTED = "[REDACTED]";

/**
 * Recursively sanitise a value for inclusion in a Sentry event.
 *
 * Rules applied at every node of the object tree:
 *  1. Objects: for each key, if the key is NOT in SAFE_KEYS the value is
 *     replaced with REDACTED. Safe keys are recursed into.
 *  2. Arrays: every element is recursed.
 *  3. Strings: any string longer than MAX_SAFE_STRING_LENGTH is replaced with
 *     REDACTED (resume / JD text is always long).
 *  4. Primitives (number, boolean, null): passed through unchanged.
 *  5. Cycle detection via WeakSet prevents infinite loops on circular refs.
 *
 * @param data  - Value to sanitise (any JSON-compatible type).
 * @param seen  - WeakSet used internally to track visited objects (cycle guard).
 */
function sanitizeValue(data: unknown, seen: WeakSet<object>): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    return data.length > MAX_SAFE_STRING_LENGTH ? REDACTED : data;
  }

  if (typeof data !== "object") {
    // number, boolean, bigint — pass through as-is
    return data;
  }

  // Cycle detection
  if (seen.has(data as object)) {
    return "[REDACTED:circular]";
  }
  seen.add(data as object);

  if (Array.isArray(data)) {
    const result = data.map((item) => sanitizeValue(item, seen));
    seen.delete(data as object);
    return result;
  }

  // Plain object: walk each key
  const obj = data as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (SAFE_KEYS.has(key)) {
      // Safe key — recurse so nested long strings / objects are still cleaned
      redacted[key] = sanitizeValue(obj[key], seen);
    } else {
      // Key not on the allowlist — keep key name but replace value entirely
      redacted[key] = REDACTED;
    }
  }
  seen.delete(data as object);
  return redacted;
}

/**
 * Sanitise a Sentry `extra` / `breadcrumb.data` payload.
 * Returns a deep-sanitised copy; the input is never mutated.
 *
 * Preserves the public API surface expected by main.tsx and tests:
 *   redactSensitiveKeys(data) → sanitised copy | undefined
 */
export function redactSensitiveKeys<T extends Record<string, unknown>>(
  data: T | undefined
): T | undefined {
  if (!data || typeof data !== "object") return data;
  return sanitizeValue(data, new WeakSet()) as T;
}

/**
 * Sanitise an entire Sentry breadcrumbs array.
 *
 * Console breadcrumbs have their `message` fully replaced with
 * "[console redacted]" — truncation is insufficient because even the
 * first 200 chars of an accidentally-logged resume can contain PII.
 */
export function sanitizeBreadcrumbs(
  breadcrumbs: Array<{ type?: string; message?: string; data?: Record<string, unknown> }>
): Array<{ type?: string; message?: string; data?: Record<string, unknown> }> {
  return breadcrumbs.map((b) => {
    const out = { ...b };
    if (out.type === "console") {
      out.message = "[console redacted]";
    }
    if (out.data) {
      out.data = redactSensitiveKeys(out.data);
    }
    return out;
  });
}

/**
 * @deprecated Prefer sanitizeBreadcrumbs for console breadcrumbs — it fully
 * replaces the message rather than truncating it.
 * Retained for backward-compat with existing call sites in main.tsx.
 */
const CONSOLE_BREADCRUMB_MAX_LENGTH = 200;

export function truncateConsoleMessage(message: string): string {
  if (message.length <= CONSOLE_BREADCRUMB_MAX_LENGTH) return message;
  return `${message.slice(0, CONSOLE_BREADCRUMB_MAX_LENGTH)}...[truncated]`;
}
