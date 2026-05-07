import type { NextFunction, Request, Response } from 'express';

import { isAdminRole } from '../services/userPolicy.js';

export function requireAdmin(req: Request, res: Response, next: NextFunction): Response | void {
  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      error_code: 'BERSN_AUTH_TOKEN_INVALID',
      message: 'Authentication required.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  if (!isAdminRole(req.auth.user.role)) {
    return res.status(403).json({
      ok: false,
      error_code: 'BERSN_AUTH_FORBIDDEN',
      message: 'Administrator privileges are required for this action.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  return next();
}
