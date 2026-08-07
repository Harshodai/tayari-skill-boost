import { getAuthRateLimit } from "@/api/auth";

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil: Date | null;
  message: string | null;
}

const RATE_LIMIT_OPEN: RateLimitResult = {
  allowed: true,
  remainingAttempts: 5,
  blockedUntil: null,
  message: null,
};

// ponytail: record_failure and reset are now server-side only — the Go audit
// worker (worker.go:71-91) writes auth_attempts on every login outcome
// (increment on failure, delete on success). The frontend no longer needs to
// drive those actions; it only READS the lockout state before a login attempt.
// Keeping these as local no-ops preserves the AuthContext call sites without
// a risky refactor of the login flow.

export async function checkRateLimit(email: string): Promise<RateLimitResult> {
  try {
    const data = await getAuthRateLimit(email);
    if (!data.allowed && data.blockedUntil) {
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil: new Date(data.blockedUntil),
        message: "Too many login attempts. Please try again later.",
      };
    }
    return {
      allowed: true,
      remainingAttempts: data.remainingAttempts,
      blockedUntil: null,
      message: null,
    };
  } catch {
    // ponytail: fail open — never block a legit login because the rate-limit
    // read failed. The Go audit worker still enforces lockouts server-side.
    return RATE_LIMIT_OPEN;
  }
}

export async function recordFailedAttempt(email: string): Promise<RateLimitResult> {
  // ponytail: no-op — Go audit worker records the failure on the actual login
  // attempt. Returning a neutral "invalid credentials" result keeps the
  // AuthContext call site shape unchanged.
  return { allowed: true, remainingAttempts: 0, blockedUntil: null, message: "Invalid credentials." };
}

export async function resetRateLimit(email: string): Promise<void> {
  // ponytail: no-op — Go audit worker resets auth_attempts on successful login.
}