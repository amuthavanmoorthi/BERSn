import type { NextFunction, Request, Response } from 'express';

import { normalizeUserRole } from '../services/userPolicy.js';

export function requireRole(...allowedRoles: string[]) {
  const normalizedRoles = new Set(allowedRoles.map((role) => normalizeUserRole(role)));

  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.auth) {
      return res.status(401).json({
        ok: false,
        error_code: 'BERSN_AUTH_TOKEN_INVALID',
        message: 'Authentication required.',
        details: { request_id: req.requestId || 'unknown' },
      });
    }

    if (!normalizedRoles.has(normalizeUserRole(req.auth.user.role))) {
      return res.status(403).json({
        ok: false,
        error_code: 'BERSN_AUTH_FORBIDDEN',
        message: 'You do not have permission to perform this action.',
        details: { request_id: req.requestId || 'unknown' },
      });
    }

    return next();
  };
}
