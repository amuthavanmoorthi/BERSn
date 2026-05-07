import { Router } from 'express';

import {
  assignProject,
  createProject,
  createProjectCalculation,
  deleteProject,
  getBuildingTypeOptions,
  getDashboardStats,
  getOrganizationOptions,
  getProject,
  getProjectAuditLog,
  getProjectCalculations,
  getProjectMembers,
  getProjects,
  previewProjectGeometry,
  revokeProjectMemberAccess,
  shareProject,
  updateProjectInfo,
  updateProjectStatus,
  updateProjectWorkspaceSettings,
} from '../controllers/projectsController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/building-types', requireAuth, getBuildingTypeOptions);
router.get('/organizations', requireAuth, getOrganizationOptions);
router.get('/projects', requireAuth, getProjects);
router.post('/projects', requireAuth, createProject);
router.get('/projects/:projectId', requireAuth, getProject);
router.patch('/projects/:projectId/project-info', requireAuth, updateProjectInfo);
router.post('/projects/:projectId/geometry/preview', requireAuth, previewProjectGeometry);
router.patch('/projects/:projectId/status', requireAuth, updateProjectStatus);
router.patch('/projects/:projectId/workspace-settings', requireAuth, updateProjectWorkspaceSettings);
router.delete('/projects/:projectId', requireAuth, deleteProject);
router.get('/projects/:projectId/calculations', requireAuth, getProjectCalculations);
router.post('/projects/:projectId/calculations', requireAuth, createProjectCalculation);
router.get('/projects/:projectId/audit-log', requireAuth, getProjectAuditLog);
router.patch('/projects/:projectId/assign', requireAuth, assignProject);
router.get('/projects/:projectId/members', requireAuth, getProjectMembers);
router.post('/projects/:projectId/members', requireAuth, shareProject);
router.delete('/projects/:projectId/members/:userId', requireAuth, revokeProjectMemberAccess);
router.get('/dashboard/stats', requireAuth, getDashboardStats);

export default router;
