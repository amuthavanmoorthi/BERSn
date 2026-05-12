import type { NextFunction, Request, Response } from 'express';

import type { Permission } from '../services/rbacPolicy.js';
import { hasPermission } from '../services/rbacPolicy.js';

/**
 * Express middleware that allows the request only if the authenticated
 * user's role grants ALL the supplied permissions. Returns 401 when no
 * authenticated session exists and 403 when the role lacks any of the
 * required permissions.
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.auth) {
      return res.status(401).json({
        ok: false,
        error_code: 'BERSN_AUTH_TOKEN_INVALID',
        message: 'Authentication required.',
        details: { request_id: req.requestId || 'unknown' },
      });
    }

    const userRole = req.auth.user.role;
    const missing = permissions.filter((permission) => !hasPermission(userRole, permission));

    if (missing.length > 0) {
      return res.status(403).json({
        ok: false,
        error_code: 'BERSN_AUTH_FORBIDDEN',
        message: 'You do not have permission to perform this action.',
        details: {
          request_id: req.requestId || 'unknown',
          missing_permissions: missing,
        },
      });
    }

    return next();
  };
}

/**
 * Allows the request if the user has ANY ONE of the supplied permissions.
 * Useful for endpoints that serve multiple role-flavoured outputs (e.g.
 * /api/projects which is reachable for VENDOR / AGENCY / ADMIN through
 * different permissions).
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.auth) {
      return res.status(401).json({
        ok: false,
        error_code: 'BERSN_AUTH_TOKEN_INVALID',
        message: 'Authentication required.',
        details: { request_id: req.requestId || 'unknown' },
      });
    }

    const userRole = req.auth.user.role;
    const granted = permissions.some((permission) => hasPermission(userRole, permission));

    if (!granted) {
      return res.status(403).json({
        ok: false,
        error_code: 'BERSN_AUTH_FORBIDDEN',
        message: 'You do not have permission to perform this action.',
        details: {
          request_id: req.requestId || 'unknown',
          required_any: permissions,
        },
      });
    }

    return next();
  };
}
