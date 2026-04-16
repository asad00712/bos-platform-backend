/**
 * Default password policy — applied at registration, password change, and
 * password reset. Per-tenant overrides can be layered on top later.
 *
 * Policy values lean on NIST SP 800-63B (2024 update) + OWASP ASVS L1:
 *   - Minimum 10 characters (stronger than the BRD's 8, aligned with 2024 best practice)
 *   - Maximum 128 characters (prevents DoS via long-password hashing)
 *   - At least 1 uppercase, 1 lowercase, 1 digit (configurable by tenant later)
 *   - Special character NOT required — modern guidance prefers length over exotic chars
 */
export const DEFAULT_PASSWORD_POLICY = {
  minLength: 10,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecialChar: false,
} as const;

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
}

export interface PasswordPolicyViolation {
  code: string;
  message: string;
}

/**
 * Checks `plaintext` against a password policy. Returns an array of
 * violations — empty array means the password passes.
 *
 * Never use the returned messages as-is in responses that could reveal
 * password content; they describe RULES only.
 */
export function checkPasswordPolicy(
  plaintext: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): PasswordPolicyViolation[] {
  const violations: PasswordPolicyViolation[] = [];

  if (plaintext.length < policy.minLength) {
    violations.push({
      code: 'min_length',
      message: `Password must be at least ${policy.minLength} characters long`,
    });
  }
  if (plaintext.length > policy.maxLength) {
    violations.push({
      code: 'max_length',
      message: `Password must not exceed ${policy.maxLength} characters`,
    });
  }
  if (policy.requireUppercase && !/[A-Z]/.test(plaintext)) {
    violations.push({
      code: 'require_uppercase',
      message: 'Password must contain at least one uppercase letter',
    });
  }
  if (policy.requireLowercase && !/[a-z]/.test(plaintext)) {
    violations.push({
      code: 'require_lowercase',
      message: 'Password must contain at least one lowercase letter',
    });
  }
  if (policy.requireDigit && !/\d/.test(plaintext)) {
    violations.push({
      code: 'require_digit',
      message: 'Password must contain at least one digit',
    });
  }
  if (policy.requireSpecialChar && !/[^A-Za-z0-9]/.test(plaintext)) {
    violations.push({
      code: 'require_special',
      message: 'Password must contain at least one special character',
    });
  }

  return violations;
}
