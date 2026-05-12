import type { Request, Response } from 'express';
import { z } from 'zod';

import {
  projectCalculationCreateSchema,
  projectCreateSchema,
  projectGeometryPreviewSchema,
  projectInfoUpdateSchema,
  projectStatusUpdateSchema,
  projectSubmitSchema,
  projectWorkspaceSettingsSchema,
} from '../schemas/projectSchemas.js';
import type { AuthServiceError } from '../services/authService.js';
import {
  assignProjectToUser,
  createProjectCalculationForUser,
  createProjectForUser,
  getBuildingTypes,
  getOrganizationsForUser,
  getProjectForUser,
  getDashboardStatsForUser,
  listProjectAuditLogsForUser,
  listProjectCalculationsForUser,
  listProjectWorkflowHistoryForUser,
  listProjectsForUser,
  previewProjectGeometryForUser,
  softDeleteProjectForUser,
  submitProjectForUser,
  updateProjectInfoForUser,
  updateProjectStatusForUser,
  updateProjectWorkspaceSettingsForUser,
} from '../services/projectService.js';

const projectIdParamSchema = z.string().uuid('Project id must be a valid UUID.');

function sendProjectError(res: Response, req: Request, error: unknown): Response {
  const serviceError = error as Partial<AuthServiceError> & { details?: unknown; message?: string };
  console.error('[projects] request failed', {
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

function getProjectIdParam(req: Request, res: Response): string | null {
  const parsedProjectId = projectIdParamSchema.safeParse(String(req.params.projectId || ''));
  if (!parsedProjectId.success) {
    res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Project id did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: {
          projectId: parsedProjectId.error.flatten().formErrors,
        },
      },
    });
    return null;
  }
  return parsedProjectId.data;
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

export async function getBuildingTypeOptions(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    const buildingTypes = await getBuildingTypes();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, building_types: buildingTypes });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function getOrganizationOptions(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  try {
    const organizations = await getOrganizationsForUser(req, req.auth);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, organizations });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function getProjects(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  try {
    const projects = await listProjectsForUser(req, req.auth);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, projects });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function createProject(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const parsedBody = projectCreateSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Project data did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: parsedBody.error.flatten().fieldErrors,
      },
    });
  }
  try {
    const project = await createProjectForUser(req, req.auth, parsedBody.data);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ ok: true, project });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function getProject(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  try {
    const project = await getProjectForUser(req, req.auth, projectId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, project });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function updateProjectInfo(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  const parsedBody = projectInfoUpdateSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Project details did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: parsedBody.error.flatten().fieldErrors,
      },
    });
  }
  try {
    const project = await updateProjectInfoForUser(req, req.auth, projectId, parsedBody.data);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, project });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function updateProjectStatus(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  const parsedBody = projectStatusUpdateSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Project status update did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: parsedBody.error.flatten().fieldErrors,
      },
    });
  }
  try {
    const project = await updateProjectStatusForUser(
      req,
      req.auth,
      projectId,
      parsedBody.data.status,
      parsedBody.data.reason,
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, project });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function submitProject(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  const parsedBody = projectSubmitSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Submission payload did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: parsedBody.error.flatten().fieldErrors,
      },
    });
  }
  try {
    const project = await submitProjectForUser(req, req.auth, projectId, parsedBody.data.reason);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, project });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function getProjectWorkflowHistory(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  try {
    const history = await listProjectWorkflowHistoryForUser(req, req.auth, projectId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, history });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function deleteProject(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  try {
    const project = await softDeleteProjectForUser(req, req.auth, projectId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, project });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function createProjectCalculation(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  const parsedBody = projectCalculationCreateSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Project calculation data did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: parsedBody.error.flatten().fieldErrors,
      },
    });
  }
  try {
    const calculation = await createProjectCalculationForUser(
      req,
      req.auth,
      projectId,
      parsedBody.data,
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ ok: true, calculation });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function updateProjectWorkspaceSettings(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  const parsedBody = projectWorkspaceSettingsSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Workspace settings did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: parsedBody.error.flatten().fieldErrors,
      },
    });
  }
  try {
    const project = await updateProjectWorkspaceSettingsForUser(
      req,
      req.auth,
      projectId,
      parsedBody.data,
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, project });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function previewProjectGeometry(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  const parsedBody = projectGeometryPreviewSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Geometry preview data did not pass validation.',
      details: {
        request_id: req.requestId || 'unknown',
        field_errors: parsedBody.error.flatten().fieldErrors,
      },
    });
  }
  try {
    const preview = await previewProjectGeometryForUser(
      req,
      req.auth,
      projectId,
      parsedBody.data,
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, preview });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function getProjectCalculations(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  const projectId = getProjectIdParam(req, res);
  if (!projectId) {
    return res;
  }
  try {
    const calculations = await listProjectCalculationsForUser(req, req.auth, projectId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, calculations });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function getProjectAuditLog(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) return res;
  const projectId = getProjectIdParam(req, res);
  if (!projectId) return res;
  try {
    const logs = await listProjectAuditLogsForUser(req, req.auth, projectId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, logs });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function assignProject(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) return res;
  const projectId = getProjectIdParam(req, res);
  if (!projectId) return res;
  const parsed = z.object({
    assigned_to: z.string().uuid().nullable(),
  }).safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'assigned_to must be a valid UUID or null.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }
  try {
    const project = await assignProjectToUser(req, req.auth, projectId, parsed.data.assigned_to);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, project });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function getDashboardStats(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) {
    return res;
  }
  try {
    const stats = await getDashboardStatsForUser(req, req.auth);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, stats });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

// ── Project Members (sharing) ─────────────────────────────────────
import {
  listProjectMembersForUser,
  revokeProjectMemberForUser,
  shareProjectWithUser,
} from '../services/projectService.js';
import { projectMemberShareSchema } from '../schemas/projectSchemas.js';

export async function getProjectMembers(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) return res;
  const projectId = getProjectIdParam(req, res);
  if (!projectId) return res;
  try {
    const members = await listProjectMembersForUser(req, req.auth, projectId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, members });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function shareProject(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) return res;
  const projectId = getProjectIdParam(req, res);
  if (!projectId) return res;
  const parsed = projectMemberShareSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'Member share data did not pass validation.',
      details: { request_id: req.requestId || 'unknown', field_errors: parsed.error.flatten().fieldErrors },
    });
  }
  try {
    const member = await shareProjectWithUser(req, req.auth, projectId, parsed.data);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ ok: true, member });
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}

export async function revokeProjectMemberAccess(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res) || !req.auth) return res;
  const projectId = getProjectIdParam(req, res);
  if (!projectId) return res;
  const userId = String(req.params.userId || '');
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'userId must be a valid UUID.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }
  try {
    await revokeProjectMemberForUser(req, req.auth, projectId, userId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).end();
  } catch (error) {
    return sendProjectError(res, req, error);
  }
}
