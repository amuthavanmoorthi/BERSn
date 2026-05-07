import type { CookieOptions } from '../types/auth.js';

function encodeValue(value: string): string {
  return encodeURIComponent(value);
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, segment) => {
      const separatorIndex = segment.indexOf('=');
      if (separatorIndex === -1) {
        return cookies;
      }

      const key = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();

      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }

      return cookies;
    }, {});
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeValue(value)}`];
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (options.sameSite) {
    if (options.sameSite === 'strict') {
      parts.push('SameSite=Strict');
    } else if (options.sameSite === 'none') {
      parts.push('SameSite=None');
    } else {
      parts.push('SameSite=Lax');
    }
  }
  return parts.join('; ');
}

export function clearCookie(name: string, options: CookieOptions = {}): string {
  return serializeCookie(name, '', {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
}
