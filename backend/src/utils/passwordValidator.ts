// =====================================================
// Password Strength Validation
// =====================================================

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-5
  errors: string[];
  suggestions: string[];
}

export interface PasswordRequirements {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
}

// Default password requirements
export const defaultRequirements: PasswordRequirements = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true,
};

// Common weak passwords to reject
const commonPasswords = [
  'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', 'letmein', 'dragon', 'baseball', 'iloveyou', 'trustno1',
  'sunshine', 'princess', 'welcome', 'admin', 'admin123', 'login',
  'passw0rd', 'master', 'hello', 'freedom', 'whatever', 'shadow',
  'qwerty123', 'password1', '123456789', '12345', '1234567', '1234567890',
  '000000', '111111', 'zaq12wsx', 'qazwsx', 'mustang', 'michael',
  'football', 'batman', 'ashley', 'bailey', 'starwars', 'charlie',
];

// Special characters allowed
const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';

/**
 * Validate password strength
 */
export function validatePassword(
  password: string,
  requirements: Partial<PasswordRequirements> = {},
  userInfo?: { name?: string; email?: string }
): PasswordValidationResult {
  const config = { ...defaultRequirements, ...requirements };
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Check if password exists
  if (!password) {
    return {
      isValid: false,
      score: 0,
      errors: ['Password is required'],
      suggestions: ['Please enter a password'],
    };
  }

  // Length checks
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  } else {
    score += 1;
    if (password.length >= 12) {
      score += 1;
      suggestions.push('Great password length!');
    } else {
      suggestions.push('Consider using a longer password for better security');
    }
  }

  if (password.length > config.maxLength) {
    errors.push(`Password must not exceed ${config.maxLength} characters`);
  }

  // Uppercase check
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    score += 0.5;
  }

  // Lowercase check
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (/[a-z]/.test(password)) {
    score += 0.5;
  }

  // Number check
  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (/\d/.test(password)) {
    score += 0.5;
  }

  // Special character check
  const hasSpecialChar = [...password].some(char => specialChars.includes(char));
  if (config.requireSpecialChars && !hasSpecialChar) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  } else if (hasSpecialChar) {
    score += 0.5;
  }

  // Common password check
  if (config.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (commonPasswords.includes(lowerPassword)) {
      errors.push('This password is too common and easily guessable');
      score = Math.max(0, score - 1);
    }
    
    // Check for sequential patterns
    if (/^(.)\1+$/.test(password)) {
      errors.push('Password cannot be a single repeated character');
      score = Math.max(0, score - 1);
    }
    
    if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/i.test(password)) {
      suggestions.push('Avoid sequential characters for better security');
      score = Math.max(0, score - 0.5);
    }
  }

  // User info check (prevent using name/email in password)
  if (config.preventUserInfo && userInfo) {
    const lowerPassword = password.toLowerCase();
    
    if (userInfo.name) {
      const nameParts = userInfo.name.toLowerCase().split(/\s+/);
      for (const part of nameParts) {
        if (part.length > 2 && lowerPassword.includes(part)) {
          errors.push('Password should not contain your name');
          score = Math.max(0, score - 1);
          break;
        }
      }
    }
    
    if (userInfo.email) {
      const emailUsername = userInfo.email.split('@')[0].toLowerCase();
      if (emailUsername.length > 2 && lowerPassword.includes(emailUsername)) {
        errors.push('Password should not contain your email');
        score = Math.max(0, score - 1);
      }
    }
  }

  // Additional suggestions
  if (errors.length === 0 && score < 4) {
    suggestions.push('Consider mixing more character types for stronger security');
  }

  // Cap score at 5
  score = Math.min(5, Math.round(score));

  return {
    isValid: errors.length === 0,
    score,
    errors,
    suggestions: errors.length === 0 ? suggestions : [],
  };
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(score: number): string {
  if (score <= 1) return 'Very Weak';
  if (score === 2) return 'Weak';
  if (score === 3) return 'Fair';
  if (score === 4) return 'Strong';
  return 'Very Strong';
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*_+-=';
  
  const allChars = uppercase + lowercase + numbers + special;
  
  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export default {
  validatePassword,
  getPasswordStrengthLabel,
  generateSecurePassword,
  defaultRequirements,
};
