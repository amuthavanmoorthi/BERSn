const ROLE_ALIASES: Record<string, string> = {
  admin: 'SYS_ADMIN',
  sys_admin: 'SYS_ADMIN',
  system_admin: 'SYS_ADMIN',
  agency_user: 'AGENCY_USER',
  reviewer: 'AGENCY_USER',
  vendor_user: 'VENDOR_USER',
};

const ADMIN_ROLE_SET = new Set(['SYS_ADMIN']);
const ALLOWED_ROLE_SET = new Set(['SYS_ADMIN', 'AGENCY_USER', 'VENDOR_USER']);
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._@-]{2,127}$/;

export function normalizeUserRole(role: string | undefined, fallback = 'AGENCY_USER'): string {
  const normalized = String(role || fallback).trim();
  if (!normalized) {
    return fallback;
  }

  const directMatch = normalized.toUpperCase();
  if (ALLOWED_ROLE_SET.has(directMatch)) {
    return directMatch;
  }

  return ROLE_ALIASES[normalized.toLowerCase()] || fallback;
}

export function isAdminRole(role: string | undefined): boolean {
  return ADMIN_ROLE_SET.has(normalizeUserRole(role, ''));
}

export function validateUsername(username: string): string[] {
  const normalized = String(username || '').trim().toLowerCase();
  const errors: string[] = [];

  if (normalized.length < 3) {
    errors.push('Username must be at least 3 characters long.');
  }
  if (normalized.length > 128) {
    errors.push('Username must be 128 characters or fewer.');
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    errors.push('Username may contain only lowercase letters, numbers, ".", "_", "-", and "@".');
  }

  return errors;
}

export function validateUserRole(role: string | undefined): string[] {
  const normalizedRole = normalizeUserRole(role);
  if (ALLOWED_ROLE_SET.has(normalizedRole)) {
    return [];
  }
  return [`Role must be one of: ${Array.from(ALLOWED_ROLE_SET).join(', ')}.`];
}
