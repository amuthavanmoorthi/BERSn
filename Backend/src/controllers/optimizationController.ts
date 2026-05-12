import type { Request, Response } from 'express';
import { z } from 'zod';

import { scenarioCreateSchema } from '../schemas/optimizationSchemas.js';
import type { AuthServiceError } from '../services/authService.js';
import {
  createProjectScenarioForUser,
  deleteProjectScenarioForUser,
  getMeasureLibraryForUser,
  listProjectScenariosForUser,
  simulateAllMeasuresForUser,
  simulateProjectScenarioForUser,
} from '../services/optimizationService.js';

const projectIdParamSchema = z.string().uuid('Project id must be a valid UUID.');
const scenarioIdParamSchema = z.string().uuid('Scenario id must be a valid UUID.');

function sendOptimizationError(res: Response, req: Request, error: unknown): Response {
  const serviceError = error as Partial<AuthServiceError> & { details?: unknown; message?: string };
  console.error('[optimization] request failed', {
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

function requireRequestAuth(req: Request, res: Response): boolean {
  if (req.auth) {
    return true;
  }
  res.status(401).json({
    ok: false,
    error_code: 'BERSN_AUTH_TOKEN_INVALID',
    message: 'Authentication required.',
    details: { request_id: req.requestId || 'unknown' },
  });
  return false;
}

function getProjectIdParam(req: Request, res: Response): string | null {
  const parsed = projectIdParamSchema.safeParse(String(req.params.projectId || ''));
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Project id did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: { projectId: parsed.error.flatten().formErrors },
      },
    });
    return null;
  }
  return parsed.data;
}

function getScenarioIdParam(req: Request, res: Response): string | null {
  const parsed = scenarioIdParamSchema.safeParse(String(req.params.scenarioId || ''));
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Scenario id did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: { scenarioId: parsed.error.flatten().formErrors },
      },
    });
    return null;
  }
  return parsed.data;
}

export async function getMeasureLibrary(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  try {
    const measures = await getMeasureLibraryForUser(req, req.auth);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json({ ok: true, measures });
  } catch (error) {
    return sendOptimizationError(res, req, error);
  }
}

export async function listProjectScenarios(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  try {
    const scenarios = await listProjectScenariosForUser(req, req.auth, projectId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, scenarios });
  } catch (error) {
    return sendOptimizationError(res, req, error);
  }
}

export async function createProjectScenario(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  const parsed = scenarioCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Scenario data did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: parsed.error.flatten().fieldErrors,
      },
    });
  }
  try {
    const scenario = await createProjectScenarioForUser(req, req.auth, projectId, parsed.data);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ ok: true, scenario });
  } catch (error) {
    return sendOptimizationError(res, req, error);
  }
}

export async function deleteProjectScenario(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  const scenarioId = getScenarioIdParam(req, res);
  if (!scenarioId) {
    return res;
  }
  try {
    await deleteProjectScenarioForUser(req, req.auth, projectId, scenarioId);
    return res.status(204).end();
  } catch (error) {
    return sendOptimizationError(res, req, error);
  }
}

export async function simulateProjectScenario(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  const scenarioId = getScenarioIdParam(req, res);
  if (!scenarioId) {
    return res;
  }
  try {
    const result = await simulateProjectScenarioForUser(req, req.auth, projectId, scenarioId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    return sendOptimizationError(res, req, error);
  }
}

export async function simulateAllMeasures(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  try {
    const bundle = await simulateAllMeasuresForUser(req, req.auth, projectId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, ...bundle });
  } catch (error) {
    return sendOptimizationError(res, req, error);
  }
}
