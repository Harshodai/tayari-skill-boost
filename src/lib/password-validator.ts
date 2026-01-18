// Password strength validation utility with comprehensive requirements

export interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
  met: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0-100
  level: 'weak' | 'fair' | 'good' | 'strong';
  requirements: PasswordRequirement[];
  allMet: boolean;
}

// Common weak passwords to check against
const commonPasswords = [
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'letmein',
  'dragon', '111111', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
  'master', 'welcome', 'shadow', 'ashley', 'football', 'jesus', 'michael',
  'ninja', 'mustang', 'password1', 'password123', 'admin', 'login',
];

// Sequential characters pattern
const sequentialChars = 'abcdefghijklmnopqrstuvwxyz01234567890';

function hasSequentialChars(password: string, length: number = 3): boolean {
  const lower = password.toLowerCase();
  for (let i = 0; i <= sequentialChars.length - length; i++) {
    const seq = sequentialChars.substring(i, i + length);
    const reverseSeq = seq.split('').reverse().join('');
    if (lower.includes(seq) || lower.includes(reverseSeq)) {
      return true;
    }
  }
  return false;
}

function hasRepeatingChars(password: string, length: number = 3): boolean {
  const regex = new RegExp(`(.)\\1{${length - 1},}`);
  return regex.test(password);
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: 'length',
      label: 'At least 12 characters',
      test: (p) => p.length >= 12,
      met: password.length >= 12,
    },
    {
      id: 'uppercase',
      label: 'One uppercase letter (A-Z)',
      test: (p) => /[A-Z]/.test(p),
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'One lowercase letter (a-z)',
      test: (p) => /[a-z]/.test(p),
      met: /[a-z]/.test(password),
    },
    {
      id: 'number',
      label: 'One number (0-9)',
      test: (p) => /[0-9]/.test(p),
      met: /[0-9]/.test(password),
    },
    {
      id: 'special',
      label: 'One special character (!@#$%^&*)',
      test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(p),
      met: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(password),
    },
  ];
}

export function validatePassword(password: string): PasswordStrengthResult {
  const requirements = getPasswordRequirements(password);
  const metCount = requirements.filter((r) => r.met).length;
  const allMet = requirements.every((r) => r.met);

  // Calculate base score from requirements (60% weight)
  let score = (metCount / requirements.length) * 60;

  // Bonus points for extra length (20% weight)
  if (password.length >= 16) {
    score += 20;
  } else if (password.length >= 14) {
    score += 15;
  } else if (password.length >= 12) {
    score += 10;
  }

  // Bonus for variety (10% weight)
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= 10) {
    score += 10;
  } else if (uniqueChars >= 8) {
    score += 7;
  } else if (uniqueChars >= 6) {
    score += 4;
  }

  // Penalties
  // Common password penalty
  if (commonPasswords.some((common) => password.toLowerCase().includes(common))) {
    score = Math.max(0, score - 30);
  }

  // Sequential characters penalty
  if (hasSequentialChars(password, 4)) {
    score = Math.max(0, score - 15);
  } else if (hasSequentialChars(password, 3)) {
    score = Math.max(0, score - 8);
  }

  // Repeating characters penalty
  if (hasRepeatingChars(password, 4)) {
    score = Math.max(0, score - 15);
  } else if (hasRepeatingChars(password, 3)) {
    score = Math.max(0, score - 8);
  }

  // Extra bonus for meeting all requirements (10% weight)
  if (allMet) {
    score += 10;
  }

  // Ensure score is between 0 and 100
  score = Math.min(100, Math.max(0, Math.round(score)));

  // Determine level
  let level: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 40) {
    level = 'weak';
  } else if (score < 60) {
    level = 'fair';
  } else if (score < 80) {
    level = 'good';
  } else {
    level = 'strong';
  }

  return {
    score,
    level,
    requirements,
    allMet,
  };
}

export function isPasswordValid(password: string): boolean {
  const result = validatePassword(password);
  return result.allMet;
}

export function getPasswordFeedback(result: PasswordStrengthResult): string {
  switch (result.level) {
    case 'weak':
      return 'This password is too weak. Please add more characters and variety.';
    case 'fair':
      return 'Getting better! Add more variety to make it stronger.';
    case 'good':
      return 'Good password! A bit more length would make it great.';
    case 'strong':
      return 'Excellent! This is a strong password.';
    default:
      return '';
  }
}
