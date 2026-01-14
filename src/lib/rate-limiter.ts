// Client-side rate limiting for authentication
const RATE_LIMIT_KEY = 'auth_rate_limit';

interface RateLimitData {
  attempts: number;
  lastAttempt: number;
  blockedUntil: number | null;
}

// Exponential backoff configuration
const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  lockoutDurations: [
    { attempts: 3, duration: 30 * 1000 },      // 30 seconds after 3 attempts
    { attempts: 5, duration: 2 * 60 * 1000 },  // 2 minutes after 5 attempts
    { attempts: 10, duration: 30 * 60 * 1000 }, // 30 minutes after 10 attempts
  ],
};

function getStorageKey(email: string): string {
  return `${RATE_LIMIT_KEY}_${email.toLowerCase()}`;
}

function getRateLimitData(email: string): RateLimitData {
  try {
    const stored = localStorage.getItem(getStorageKey(email));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parsing errors
  }
  return { attempts: 0, lastAttempt: 0, blockedUntil: null };
}

function setRateLimitData(email: string, data: RateLimitData): void {
  try {
    localStorage.setItem(getStorageKey(email), JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function checkRateLimit(email: string): { 
  allowed: boolean; 
  remainingAttempts: number;
  blockedUntil: Date | null;
  message: string | null;
} {
  const data = getRateLimitData(email);
  const now = Date.now();

  // Check if currently blocked
  if (data.blockedUntil && data.blockedUntil > now) {
    const remainingSeconds = Math.ceil((data.blockedUntil - now) / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeString = minutes > 0 
      ? `${minutes}m ${seconds}s` 
      : `${seconds}s`;
    
    return {
      allowed: false,
      remainingAttempts: 0,
      blockedUntil: new Date(data.blockedUntil),
      message: `Too many login attempts. Please try again in ${timeString}.`,
    };
  }

  // Reset if blocked period has passed
  if (data.blockedUntil && data.blockedUntil <= now) {
    // Allow retry but keep attempt count to escalate lockout on next failure
    return {
      allowed: true,
      remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts - data.attempts,
      blockedUntil: null,
      message: null,
    };
  }

  const remainingAttempts = Math.max(0, RATE_LIMIT_CONFIG.maxAttempts - data.attempts);
  
  return {
    allowed: true,
    remainingAttempts,
    blockedUntil: null,
    message: remainingAttempts <= 2 && remainingAttempts > 0 
      ? `${remainingAttempts} attempts remaining before temporary lockout.`
      : null,
  };
}

export function recordFailedAttempt(email: string): { 
  blockedUntil: Date | null;
  message: string;
} {
  const data = getRateLimitData(email);
  const now = Date.now();

  data.attempts += 1;
  data.lastAttempt = now;

  // Check if we need to apply a lockout
  let lockoutDuration = 0;
  for (const config of RATE_LIMIT_CONFIG.lockoutDurations) {
    if (data.attempts >= config.attempts) {
      lockoutDuration = config.duration;
    }
  }

  if (lockoutDuration > 0) {
    data.blockedUntil = now + lockoutDuration;
  }

  setRateLimitData(email, data);

  if (data.blockedUntil) {
    const remainingSeconds = Math.ceil(lockoutDuration / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeString = minutes > 0 
      ? `${minutes} minute${minutes > 1 ? 's' : ''}` 
      : `${seconds} seconds`;
    
    return {
      blockedUntil: new Date(data.blockedUntil),
      message: `Too many failed attempts. Account temporarily locked for ${timeString}.`,
    };
  }

  const remainingAttempts = RATE_LIMIT_CONFIG.maxAttempts - data.attempts;
  return {
    blockedUntil: null,
    message: remainingAttempts > 0 
      ? `Invalid credentials. ${remainingAttempts} attempts remaining.`
      : 'Invalid credentials.',
  };
}

export function resetRateLimit(email: string): void {
  try {
    localStorage.removeItem(getStorageKey(email));
  } catch {
    // Ignore storage errors
  }
}

export function getRemainingCooldown(email: string): number {
  const data = getRateLimitData(email);
  if (data.blockedUntil && data.blockedUntil > Date.now()) {
    return Math.ceil((data.blockedUntil - Date.now()) / 1000);
  }
  return 0;
}
