/**
 * Maps detailed Supabase auth errors to generic user-facing messages
 * to prevent information leakage (account enumeration, system fingerprinting)
 */
export const getGenericAuthError = (error: string): string => {
  const lowerError = error.toLowerCase();
  
  // Invalid credentials - don't reveal if email exists or password is wrong
  if (
    lowerError.includes('invalid login credentials') ||
    lowerError.includes('user not found') ||
    lowerError.includes('email not confirmed') ||
    lowerError.includes('invalid email or password')
  ) {
    return 'Invalid email or password. Please try again.';
  }
  
  // Password policy errors - give generic guidance
  if (lowerError.includes('password')) {
    return 'Password does not meet requirements. Must be at least 8 characters.';
  }
  
  // Rate limiting - generic message
  if (lowerError.includes('rate limit') || lowerError.includes('too many')) {
    return 'Too many attempts. Please try again later.';
  }
  
  // Email already registered - don't confirm existence
  if (lowerError.includes('already registered') || lowerError.includes('already exists')) {
    return 'Unable to create account. Please try again or sign in.';
  }
  
  // OAuth errors - generic
  if (lowerError.includes('oauth') || lowerError.includes('provider')) {
    return 'Social login failed. Please try again or use email/password.';
  }
  
  // Default generic message
  return 'Authentication failed. Please try again.';
};
