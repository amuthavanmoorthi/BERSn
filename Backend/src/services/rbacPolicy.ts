/**
 * Single source of truth for role-based access control (RBAC) and the
 * project-lifecycle workflow state machine.
 *
 * Every authorization decision in the backend (middleware, services,
 * controllers, even the database seed scripts) imports from this module
 * so that role checks and workflow transitions stay consistent.
 *
 * The frontend mirrors the permission keys and workflow state names in
 * FrontEnd/bern5/services/rbacPolicy.ts; any change here must be
 * reflected there as well.
 */

import { normalizeUserRole } from './userPolicy.js';

// ─────────────────────────────────────────────────────────────────────
// 1. Roles
// ─────────────────────────────────────────────────────────────────────

export const ROLES = {
  SYS_ADMIN: 'SYS_ADMIN',
  AGENCY_USER: 'AGENCY_USER',
  VENDOR_USER: 'VENDOR_USER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly Role[] = [
  ROLES.SYS_ADMIN,
  ROLES.AGENCY_USER,
  ROLES.VENDOR_USER,
];

export function asRole(role: string | undefined | null): Role {
  return normalizeUserRole(role || '', ROLES.VENDOR_USER) as Role;
}

export function isAdmin(role: string | undefined | null): boolean {
  return asRole(role) === ROLES.SYS_ADMIN;
}

export function isAgency(role: string | undefined | null): boolean {
  return asRole(role) === ROLES.AGENCY_USER;
}

export function isVendor(role: string | undefined | null): boolean {
  return asRole(role) === ROLES.VENDOR_USER;
}

// ─────────────────────────────────────────────────────────────────────
// 2. Permissions
// ─────────────────────────────────────────────────────────────────────
//
// Permissions are coarse-grained capability flags grouped by area.
// They are NEVER hard-coded against role strings in the rest of the
// codebase — call hasPermission(role, perm) instead.

export const PERMISSIONS = {
  USER_CREATE: 'user:create',
  USER_LIST: 'user:list',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  PROJECT_CREATE: 'project:create',
  PROJECT_VIEW_ALL: 'project:view_all',
  PROJECT_VIEW_ASSIGNED: 'project:view_assigned',
  PROJECT_VIEW_OWN: 'project:view_own',
  PROJECT_EDIT_OWN: 'project:edit_own',
  PROJECT_EDIT_ANY: 'project:edit_any',
  PROJECT_SUBMIT: 'project:submit',
  PROJECT_DELETE: 'project:delete',
  PROJECT_ASSIGN: 'project:assign',
  PROJECT_EXPORT_OWN: 'project:export_own',
  PROJECT_EXPORT_ALL: 'project:export_all',
  PROJECT_REOPEN: 'project:reopen',

  WORKFLOW_REVIEW: 'workflow:review',
  WORKFLOW_APPROVE: 'workflow:approve',
  WORKFLOW_REJECT: 'workflow:reject',
  WORKFLOW_REQUEST_REVISION: 'workflow:request_revision',
  WORKFLOW_COMPLETE: 'workflow:complete',
  WORKFLOW_OVERRIDE: 'workflow:override',

  DASHBOARD_GLOBAL: 'dashboard:global',
  DASHBOARD_AGENCY: 'dashboard:agency',
  DASHBOARD_VENDOR: 'dashboard:vendor',

  ANALYTICS_VIEW_ALL: 'analytics:view_all',
  ANALYTICS_VIEW_SCOPED: 'analytics:view_scoped',

  SYSTEM_CONFIG: 'system:config',
  AUDIT_LOG_VIEW: 'audit:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Per-role permission table.
 * Add or remove capabilities here — never inline a role check elsewhere.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.SYS_ADMIN]: [
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_LIST,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,

    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_VIEW_ALL,
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.PROJECT_VIEW_OWN,
    PERMISSIONS.PROJECT_EDIT_OWN,
    PERMISSIONS.PROJECT_EDIT_ANY,
    PERMISSIONS.PROJECT_SUBMIT,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.PROJECT_ASSIGN,
    PERMISSIONS.PROJECT_EXPORT_OWN,
    PERMISSIONS.PROJECT_EXPORT_ALL,
    PERMISSIONS.PROJECT_REOPEN,

    PERMISSIONS.WORKFLOW_REVIEW,
    PERMISSIONS.WORKFLOW_APPROVE,
    PERMISSIONS.WORKFLOW_REJECT,
    PERMISSIONS.WORKFLOW_REQUEST_REVISION,
    PERMISSIONS.WORKFLOW_COMPLETE,
    PERMISSIONS.WORKFLOW_OVERRIDE,

    PERMISSIONS.DASHBOARD_GLOBAL,
    PERMISSIONS.DASHBOARD_AGENCY,
    PERMISSIONS.DASHBOARD_VENDOR,

    PERMISSIONS.ANALYTICS_VIEW_ALL,
    PERMISSIONS.ANALYTICS_VIEW_SCOPED,

    PERMISSIONS.SYSTEM_CONFIG,
    PERMISSIONS.AUDIT_LOG_VIEW,
  ],
  [ROLES.AGENCY_USER]: [
    PERMISSIONS.PROJECT_VIEW_ASSIGNED,
    PERMISSIONS.WORKFLOW_REVIEW,
    PERMISSIONS.WORKFLOW_APPROVE,
    PERMISSIONS.WORKFLOW_REJECT,
    PERMISSIONS.WORKFLOW_REQUEST_REVISION,
    PERMISSIONS.WORKFLOW_COMPLETE,
    PERMISSIONS.DASHBOARD_AGENCY,
    PERMISSIONS.ANALYTICS_VIEW_SCOPED,
    PERMISSIONS.AUDIT_LOG_VIEW,
  ],
  [ROLES.VENDOR_USER]: [
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_VIEW_OWN,
    PERMISSIONS.PROJECT_EDIT_OWN,
    PERMISSIONS.PROJECT_SUBMIT,
    PERMISSIONS.PROJECT_EXPORT_OWN,
    PERMISSIONS.DASHBOARD_VENDOR,
    PERMISSIONS.ANALYTICS_VIEW_SCOPED,
  ],
};

const ROLE_PERMISSION_SETS: Record<Role, ReadonlySet<Permission>> = {
  [ROLES.SYS_ADMIN]: new Set<Permission>(ROLE_PERMISSIONS[ROLES.SYS_ADMIN]),
  [ROLES.AGENCY_USER]: new Set<Permission>(ROLE_PERMISSIONS[ROLES.AGENCY_USER]),
  [ROLES.VENDOR_USER]: new Set<Permission>(ROLE_PERMISSIONS[ROLES.VENDOR_USER]),
};

export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  const normalized = asRole(role);
  return ROLE_PERMISSION_SETS[normalized]?.has(permission) ?? false;
}

export function permissionsForRole(role: string | undefined | null): readonly Permission[] {
  const normalized = asRole(role);
  return ROLE_PERMISSIONS[normalized] ?? [];
}

// ─────────────────────────────────────────────────────────────────────
// 3. Workflow state machine
// ─────────────────────────────────────────────────────────────────────

export const WORKFLOW_STATES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[keyof typeof WORKFLOW_STATES];

export const ALL_WORKFLOW_STATES: readonly WorkflowState[] = [
  WORKFLOW_STATES.DRAFT,
  WORKFLOW_STATES.SUBMITTED,
  WORKFLOW_STATES.UNDER_REVIEW,
  WORKFLOW_STATES.APPROVED,
  WORKFLOW_STATES.REJECTED,
  WORKFLOW_STATES.REVISION_REQUESTED,
  WORKFLOW_STATES.COMPLETED,
  WORKFLOW_STATES.ARCHIVED,
];

const WORKFLOW_STATE_SET = new Set<string>(ALL_WORKFLOW_STATES);

export function isWorkflowState(value: unknown): value is WorkflowState {
  return typeof value === 'string' && WORKFLOW_STATE_SET.has(value);
}

/**
 * Allowed (from → to) transitions for each role.
 * Admin gets WORKFLOW_OVERRIDE, which lets them perform any transition
 * not listed here (see {@link canTransition}).
 */
type TransitionMap = Record<WorkflowState, readonly WorkflowState[]>;

const VENDOR_TRANSITIONS: TransitionMap = {
  [WORKFLOW_STATES.DRAFT]: [WORKFLOW_STATES.SUBMITTED],
  [WORKFLOW_STATES.REVISION_REQUESTED]: [WORKFLOW_STATES.SUBMITTED],
  [WORKFLOW_STATES.SUBMITTED]: [],
  [WORKFLOW_STATES.UNDER_REVIEW]: [],
  [WORKFLOW_STATES.APPROVED]: [],
  [WORKFLOW_STATES.REJECTED]: [],
  [WORKFLOW_STATES.COMPLETED]: [],
  [WORKFLOW_STATES.ARCHIVED]: [],
};

const AGENCY_TRANSITIONS: TransitionMap = {
  [WORKFLOW_STATES.SUBMITTED]: [WORKFLOW_STATES.UNDER_REVIEW],
  [WORKFLOW_STATES.UNDER_REVIEW]: [
    WORKFLOW_STATES.APPROVED,
    WORKFLOW_STATES.REJECTED,
    WORKFLOW_STATES.REVISION_REQUESTED,
  ],
  [WORKFLOW_STATES.APPROVED]: [WORKFLOW_STATES.COMPLETED],
  [WORKFLOW_STATES.REVISION_REQUESTED]: [],
  [WORKFLOW_STATES.DRAFT]: [],
  [WORKFLOW_STATES.REJECTED]: [],
  [WORKFLOW_STATES.COMPLETED]: [],
  [WORKFLOW_STATES.ARCHIVED]: [],
};

const ROLE_TRANSITIONS: Record<Role, TransitionMap> = {
  [ROLES.SYS_ADMIN]: {
    // Filled below — admins can perform any non-noop transition.
    [WORKFLOW_STATES.DRAFT]: [],
    [WORKFLOW_STATES.SUBMITTED]: [],
    [WORKFLOW_STATES.UNDER_REVIEW]: [],
    [WORKFLOW_STATES.APPROVED]: [],
    [WORKFLOW_STATES.REJECTED]: [],
    [WORKFLOW_STATES.REVISION_REQUESTED]: [],
    [WORKFLOW_STATES.COMPLETED]: [],
    [WORKFLOW_STATES.ARCHIVED]: [],
  },
  [ROLES.AGENCY_USER]: AGENCY_TRANSITIONS,
  [ROLES.VENDOR_USER]: VENDOR_TRANSITIONS,
};

for (const fromState of ALL_WORKFLOW_STATES) {
  ROLE_TRANSITIONS[ROLES.SYS_ADMIN][fromState] = ALL_WORKFLOW_STATES.filter((to) => to !== fromState);
}

export interface TransitionDecision {
  allowed: boolean;
  reason?:
    | 'unknown_state'
    | 'role_not_permitted'
    | 'noop_transition'
    | 'transition_not_defined';
}

export function canTransition(
  role: string | undefined | null,
  fromStatus: WorkflowState,
  toStatus: WorkflowState,
): TransitionDecision {
  if (!isWorkflowState(fromStatus) || !isWorkflowState(toStatus)) {
    return { allowed: false, reason: 'unknown_state' };
  }
  if (fromStatus === toStatus) {
    return { allowed: false, reason: 'noop_transition' };
  }
  const normalizedRole = asRole(role);
  const map = ROLE_TRANSITIONS[normalizedRole];
  if (!map) {
    return { allowed: false, reason: 'role_not_permitted' };
  }
  const allowedTargets = map[fromStatus] ?? [];
  if (!allowedTargets.includes(toStatus)) {
    return { allowed: false, reason: 'transition_not_defined' };
  }
  return { allowed: true };
}

export function allowedTransitionsFor(
  role: string | undefined | null,
  fromStatus: WorkflowState,
): readonly WorkflowState[] {
  if (!isWorkflowState(fromStatus)) {
    return [];
  }
  const normalizedRole = asRole(role);
  return ROLE_TRANSITIONS[normalizedRole]?.[fromStatus] ?? [];
}

/**
 * Whether a project in the given workflow state can have its
 * project info / workspace settings edited.
 *
 * A vendor may only edit their own DRAFT or REVISION_REQUESTED
 * projects; an agency reviewer never edits content; an admin
 * may edit at any state.
 */
export function canEditProjectContent(
  role: string | undefined | null,
  status: WorkflowState,
  isOwner: boolean,
): boolean {
  if (isAdmin(role)) return true;
  if (!isOwner) return false;
  if (!hasPermission(role, PERMISSIONS.PROJECT_EDIT_OWN)) return false;
  return status === WORKFLOW_STATES.DRAFT || status === WORKFLOW_STATES.REVISION_REQUESTED;
}

/**
 * Maps a workflow transition to the canonical audit-log action token.
 * Centralised here so audit_log strings stay consistent.
 */
export function auditActionForTransition(toStatus: WorkflowState): string {
  switch (toStatus) {
    case WORKFLOW_STATES.SUBMITTED:
      return 'SUBMITTED';
    case WORKFLOW_STATES.UNDER_REVIEW:
      return 'REVIEW_STARTED';
    case WORKFLOW_STATES.APPROVED:
      return 'APPROVED';
    case WORKFLOW_STATES.REJECTED:
      return 'REJECTED';
    case WORKFLOW_STATES.REVISION_REQUESTED:
      return 'REVISION_REQUESTED';
    case WORKFLOW_STATES.COMPLETED:
      return 'COMPLETED';
    case WORKFLOW_STATES.DRAFT:
      return 'REOPENED';
    case WORKFLOW_STATES.ARCHIVED:
      return 'DELETED';
    default:
      return 'UPDATED';
  }
}
