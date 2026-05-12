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
  getProjectWorkflowHistory,
  previewProjectGeometry,
  revokeProjectMemberAccess,
  shareProject,
  submitProject,
  updateProjectInfo,
  updateProjectStatus,
  updateProjectWorkspaceSettings,
} from '../controllers/projectsController.js';
import {
  createProjectScenario,
  deleteProjectScenario,
  listProjectScenarios,
  simulateAllMeasures,
  simulateProjectScenario,
} from '../controllers/optimizationController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  requireAnyPermission,
  requirePermission,
} from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../services/rbacPolicy.js';

const router = Router();

// Reference data — every authenticated user can read it.
router.get('/building-types', requireAuth, getBuildingTypeOptions);
router.get('/organizations', requireAuth, getOrganizationOptions);

// Project list / create — service layer scopes results per role.
router.get(
  '/projects',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_VIEW_ALL,
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.PROJECT_VIEW_OWN,
  ),
  getProjects,
);
router.post(
  '/projects',
  requireAuth,
  requirePermission(PERMISSIONS.PROJECT_CREATE),
  createProject,
);

// Individual project — service does fine-grained ownership/org scoping.
router.get(
  '/projects/:projectId',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_VIEW_ALL,
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.PROJECT_VIEW_OWN,
  ),
  getProject,
);

// Edit project info / workspace — vendor/admin only, plus per-project owner check.
router.patch(
  '/projects/:projectId/project-info',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_EDIT_OWN,
    PERMISSIONS.PROJECT_EDIT_ANY,
  ),
  updateProjectInfo,
);
router.patch(
  '/projects/:projectId/workspace-settings',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_EDIT_OWN,
    PERMISSIONS.PROJECT_EDIT_ANY,
  ),
  updateProjectWorkspaceSettings,
);

// Geometry preview — read-only; allow anyone who can view the project.
router.post(
  '/projects/:projectId/geometry/preview',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_VIEW_ALL,
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.PROJECT_VIEW_OWN,
  ),
  previewProjectGeometry,
);

// Submission — vendors and admins; agencies cannot self-submit.
router.post(
  '/projects/:projectId/submit',
  requireAuth,
  requirePermission(PERMISSIONS.PROJECT_SUBMIT),
  submitProject,
);

// Workflow status updates — agency reviewers and admins.
// Vendors must never reach this endpoint; rbacPolicy.canTransition()
// blocks any vendor-initiated transition other than DRAFT→SUBMITTED
// (which is handled by /submit, not /status).
router.patch(
  '/projects/:projectId/status',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.WORKFLOW_REVIEW,
    PERMISSIONS.WORKFLOW_APPROVE,
    PERMISSIONS.WORKFLOW_REJECT,
    PERMISSIONS.WORKFLOW_REQUEST_REVISION,
    PERMISSIONS.WORKFLOW_COMPLETE,
    PERMISSIONS.WORKFLOW_OVERRIDE,
  ),
  updateProjectStatus,
);

// Project deletion — admin always; service allows vendor to delete own draft.
router.delete(
  '/projects/:projectId',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.PROJECT_EDIT_OWN,
  ),
  deleteProject,
);

// Calculations.
router.get(
  '/projects/:projectId/calculations',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_VIEW_ALL,
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.PROJECT_VIEW_OWN,
  ),
  getProjectCalculations,
);
router.post(
  '/projects/:projectId/calculations',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_EDIT_OWN,
    PERMISSIONS.PROJECT_EDIT_ANY,
    PERMISSIONS.WORKFLOW_REVIEW,
  ),
  createProjectCalculation,
);

// Audit log + workflow history viewing.
router.get(
  '/projects/:projectId/audit-log',
  requireAuth,
  requirePermission(PERMISSIONS.AUDIT_LOG_VIEW),
  getProjectAuditLog,
);
router.get(
  '/projects/:projectId/workflow-history',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_VIEW_ALL,
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.PROJECT_VIEW_OWN,
  ),
  getProjectWorkflowHistory,
);

// Assignment — admin only.
router.patch(
  '/projects/:projectId/assign',
  requireAuth,
  requirePermission(PERMISSIONS.PROJECT_ASSIGN),
  assignProject,
);

// Project sharing (project-level ACL) — service double-checks ownership.
router.get(
  '/projects/:projectId/members',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_VIEW_ALL,
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.PROJECT_VIEW_OWN,
  ),
  getProjectMembers,
);
router.post(
  '/projects/:projectId/members',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_EDIT_OWN,
    PERMISSIONS.PROJECT_EDIT_ANY,
  ),
  shareProject,
);
router.delete(
  '/projects/:projectId/members/:userId',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_EDIT_OWN,
    PERMISSIONS.PROJECT_EDIT_ANY,
  ),
  revokeProjectMemberAccess,
);

router.get(
  '/dashboard/stats',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.DASHBOARD_GLOBAL,
    PERMISSIONS.DASHBOARD_AGENCY,
    PERMISSIONS.DASHBOARD_VENDOR,
  ),
  getDashboardStats,
);

// Optimization scenarios + per-measure CP ranking
router.get(
  '/projects/:projectId/scenarios',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_VIEW_ALL,
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.PROJECT_VIEW_OWN,
  ),
  listProjectScenarios,
);
router.post(
  '/projects/:projectId/scenarios',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_EDIT_OWN,
    PERMISSIONS.PROJECT_EDIT_ANY,
  ),
  createProjectScenario,
);
router.delete(
  '/projects/:projectId/scenarios/:scenarioId',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_EDIT_OWN,
    PERMISSIONS.PROJECT_EDIT_ANY,
  ),
  deleteProjectScenario,
);
router.post(
  '/projects/:projectId/scenarios/:scenarioId/simulate',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_VIEW_ALL,
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.PROJECT_VIEW_OWN,
  ),
  simulateProjectScenario,
);
router.post(
  '/projects/:projectId/measures/simulate-all',
  requireAuth,
  requireAnyPermission(
    PERMISSIONS.PROJECT_VIEW_ALL,
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.PROJECT_VIEW_OWN,
  ),
  simulateAllMeasures,
);

export default router;
