import type { Request, Response } from 'express';

import type { AuthServiceError } from '../services/authService.js';
import {
  createUserAccountAsAdmin,
  listUsersForAdmin,
  deleteManagedUserAsAdmin,
  updateUserAccountStatusAsAdmin,
} from '../services/userManagementService.js';
import {
  managedUserCreateSchema,
  managedUserStatusSchema,
} from '../schemas/userManagementSchemas.js';

function sendUsersError(res: Response, req: Request, error: unknown): Response {
  const serviceError = error as Partial<AuthServiceError> & { details?: unknown; message?: string };
  console.error('[users] request failed', {
    request_id: req.requestId || 'unknown',
    method: req.method,
    path: req.originalUrl,
    error,
  });
  return res.status(serviceError.status || 500).json({
    ok: false,
    error_code: serviceError.errorCode || 'BERSN_API_INTERNAL_ERROR',
    message: serviceError.message || 'Internal server error.',
    details: serviceError.details || { request_id: req.requestId || 'unknown' },
  });
}

export async function getUsers(req: Request, res: Response): Promise<Response> {
  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      error_code: 'BERSN_AUTH_TOKEN_INVALID',
      message: 'Authentication required.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  try {
    const users = await listUsersForAdmin(req, req.auth);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, users });
  } catch (error) {
    return sendUsersError(res, req, error);
  }
}

export async function createUser(req: Request, res: Response): Promise<Response> {
  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      error_code: 'BERSN_AUTH_TOKEN_INVALID',
      message: 'Authentication required.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  const parsedBody = managedUserCreateSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Account data did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: parsedBody.error.flatten().fieldErrors,
      },
    });
  }

  try {
    const result = await createUserAccountAsAdmin(req, req.auth, parsedBody.data);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      ok: true,
      user: result.user,
      delivery_mode: result.deliveryMode,
      delivery_reason: result.deliveryReason,
    });
  } catch (error) {
    return sendUsersError(res, req, error);
  }
}

export async function updateUserStatus(req: Request, res: Response): Promise<Response> {
  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      error_code: 'BERSN_AUTH_TOKEN_INVALID',
      message: 'Authentication required.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  const parsedBody = managedUserStatusSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Account status update did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: parsedBody.error.flatten().fieldErrors,
      },
    });
  }

  try {
    const user = await updateUserAccountStatusAsAdmin(
      req,
      req.auth,
      String(req.params.userId || ''),
      parsedBody.data.is_active,
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, user });
  } catch (error) {
    return sendUsersError(res, req, error);
  }
}

export async function deleteUser(req: Request, res: Response): Promise<Response> {
  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      error_code: 'BERSN_AUTH_TOKEN_INVALID',
      message: 'Authentication required.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  try {
    const result = await deleteManagedUserAsAdmin(
      req,
      req.auth,
      String(req.params.userId || ''),
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return sendUsersError(res, req, error);
  }
}
