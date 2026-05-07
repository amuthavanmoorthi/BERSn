import { authConfig } from '../config/authConfig.js';

function hasUppercase(value: string): boolean {
  return /[A-Z]/.test(value);
}

function hasLowercase(value: string): boolean {
  return /[a-z]/.test(value);
}

function hasDigit(value: string): boolean {
  return /\d/.test(value);
}

function hasSymbol(value: string): boolean {
  return /[^A-Za-z0-9]/.test(value);
}

export function validatePasswordStrength(password: string, username?: string): string[] {
  const errors: string[] = [];
  const normalizedPassword = String(password || '');
  const normalizedUsername = String(username || '').trim().toLowerCase();

  if (normalizedPassword.length < authConfig.passwordMinLength) {
    errors.push(`Password must be at least ${authConfig.passwordMinLength} characters long.`);
  }
  if (!hasUppercase(normalizedPassword)) {
    errors.push('Password must include at least one uppercase letter.');
  }
  if (!hasLowercase(normalizedPassword)) {
    errors.push('Password must include at least one lowercase letter.');
  }
  if (!hasDigit(normalizedPassword)) {
    errors.push('Password must include at least one number.');
  }
  if (!hasSymbol(normalizedPassword)) {
    errors.push('Password must include at least one symbol.');
  }
  if (normalizedUsername && normalizedPassword.toLowerCase().includes(normalizedUsername)) {
    errors.push('Password must not contain the username.');
  }

  return errors;
}
