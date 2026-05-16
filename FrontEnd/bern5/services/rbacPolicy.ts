/**
 * Frontend mirror of Backend/src/services/rbacPolicy.ts.
 *
 * Permission keys and workflow-state names MUST match the backend
 * verbatim. The UI uses these to drive conditional rendering and
 * disabled states — but the backend remains the single source of
 * truth: every protected action also goes through a server-side
 * permission check (see Backend middleware/requirePermission.ts and
 * service/rbacPolicy.ts canTransition()).
 *
 * Never use these helpers as your only line of defence; always pair
 * them with the backend API response.
 */

export const ROLES = {
    SYS_ADMIN: 'SYS_ADMIN',
    AGENCY_USER: 'AGENCY_USER',
    VENDOR_USER: 'VENDOR_USER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

const ROLE_ALIASES: Record<string, Role> = {
    admin: ROLES.SYS_ADMIN,
    sys_admin: ROLES.SYS_ADMIN,
    system_admin: ROLES.SYS_ADMIN,
    reviewer: ROLES.AGENCY_USER,
    agency_user: ROLES.AGENCY_USER,
    vendor_user: ROLES.VENDOR_USER,
};

const ALLOWED_ROLES: ReadonlySet<string> = new Set<string>([
    ROLES.SYS_ADMIN,
    ROLES.AGENCY_USER,
    ROLES.VENDOR_USER,
]);

export function normalizeRole(role: string | undefined | null, fallback: Role = ROLES.VENDOR_USER): Role {
    const raw = String(role || '').trim();
    if (!raw) return fallback;
    const upper = raw.toUpperCase();
    if (ALLOWED_ROLES.has(upper)) {
        return upper as Role;
    }
    return ROLE_ALIASES[raw.toLowerCase()] || fallback;
}

export function isAdmin(role: string | undefined | null): boolean {
    return normalizeRole(role) === ROLES.SYS_ADMIN;
}

export function isAgency(role: string | undefined | null): boolean {
    return normalizeRole(role) === ROLES.AGENCY_USER;
}

export function isVendor(role: string | undefined | null): boolean {
    return normalizeRole(role) === ROLES.VENDOR_USER;
}

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
        // Per the BERSn role spec, an agency reviewer can also author
        // their own projects — typically when capturing data on behalf
        // of a vendor or running an internal pilot. The review-side
        // capabilities below are the primary workflow.
        PERMISSIONS.PROJECT_CREATE,
        PERMISSIONS.PROJECT_VIEW_OWN,
        PERMISSIONS.PROJECT_VIEW_ASSIGNED,
        PERMISSIONS.PROJECT_EDIT_OWN,
        PERMISSIONS.PROJECT_SUBMIT,
        PERMISSIONS.PROJECT_EXPORT_OWN,
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

export function permissionsForRole(role: string | undefined | null): readonly Permission[] {
    const normalized = normalizeRole(role);
    return ROLE_PERMISSIONS[normalized] ?? [];
}

export function hasPermission(
    grantedPermissions: readonly Permission[] | null | undefined,
    permission: Permission,
): boolean {
    if (!grantedPermissions || grantedPermissions.length === 0) return false;
    return grantedPermissions.includes(permission);
}

export function hasAnyPermission(
    grantedPermissions: readonly Permission[] | null | undefined,
    permissions: readonly Permission[],
): boolean {
    if (!grantedPermissions || grantedPermissions.length === 0) return false;
    return permissions.some((p) => grantedPermissions.includes(p));
}

// ─────────────────────────────────────────────────────────────────────
// Workflow state machine (mirrors backend rbacPolicy.ts)
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

export function isWorkflowState(value: unknown): value is WorkflowState {
    return typeof value === 'string'
        && (ALL_WORKFLOW_STATES as readonly string[]).includes(value);
}

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
    // Agency users can author their own projects, so they need the same
    // forward-submit transitions a vendor has on a DRAFT they created.
    // Per-project ownership is enforced separately in the workflow
    // panel (`isOwner` gate below) and by the backend service layer.
    [WORKFLOW_STATES.DRAFT]: [WORKFLOW_STATES.SUBMITTED],
    [WORKFLOW_STATES.REVISION_REQUESTED]: [WORKFLOW_STATES.SUBMITTED],
    [WORKFLOW_STATES.SUBMITTED]: [WORKFLOW_STATES.UNDER_REVIEW],
    [WORKFLOW_STATES.UNDER_REVIEW]: [
        WORKFLOW_STATES.APPROVED,
        WORKFLOW_STATES.REJECTED,
        WORKFLOW_STATES.REVISION_REQUESTED,
    ],
    [WORKFLOW_STATES.APPROVED]: [WORKFLOW_STATES.COMPLETED],
    [WORKFLOW_STATES.REJECTED]: [],
    [WORKFLOW_STATES.COMPLETED]: [],
    [WORKFLOW_STATES.ARCHIVED]: [],
};

const ADMIN_TRANSITIONS = Object.fromEntries(
    ALL_WORKFLOW_STATES.map((from) => [
        from,
        ALL_WORKFLOW_STATES.filter((to) => to !== from),
    ]),
) as unknown as TransitionMap;

const ROLE_TRANSITIONS: Record<Role, TransitionMap> = {
    [ROLES.SYS_ADMIN]: ADMIN_TRANSITIONS,
    [ROLES.AGENCY_USER]: AGENCY_TRANSITIONS,
    [ROLES.VENDOR_USER]: VENDOR_TRANSITIONS,
};

export function allowedTransitionsFor(
    role: string | undefined | null,
    from: WorkflowState,
): readonly WorkflowState[] {
    if (!isWorkflowState(from)) return [];
    const normalized = normalizeRole(role);
    return ROLE_TRANSITIONS[normalized]?.[from] ?? [];
}

export function canTransition(
    role: string | undefined | null,
    from: WorkflowState,
    to: WorkflowState,
): boolean {
    return allowedTransitionsFor(role, from).includes(to);
}

/**
 * Whether a user with the given role can edit project content (info /
 * workspace settings) for a project in the given state. The `isOwner`
 * argument should be true iff the user created or is assigned to the
 * project.
 */
export function canEditProjectContent(
    role: string | undefined | null,
    status: WorkflowState,
    isOwner: boolean,
): boolean {
    if (isAdmin(role)) return true;
    if (!isOwner) return false;
    if (!hasPermission(permissionsForRole(role), PERMISSIONS.PROJECT_EDIT_OWN)) return false;
    return status === WORKFLOW_STATES.DRAFT || status === WORKFLOW_STATES.REVISION_REQUESTED;
}

export interface WorkflowStateDisplay {
    en: string;
    zh: string;
    badgeClass: string;
    icon: string;
}

export const WORKFLOW_STATE_DISPLAY: Record<WorkflowState, WorkflowStateDisplay> = {
    [WORKFLOW_STATES.DRAFT]: {
        en: 'Draft',
        zh: '草稿',
        badgeClass: 'bg-slate-100 text-slate-600',
        icon: '📝',
    },
    [WORKFLOW_STATES.SUBMITTED]: {
        en: 'Submitted',
        zh: '已提交',
        badgeClass: 'bg-indigo-100 text-indigo-600',
        icon: '📨',
    },
    [WORKFLOW_STATES.UNDER_REVIEW]: {
        en: 'Under Review',
        zh: '審查中',
        badgeClass: 'bg-blue-100 text-blue-600',
        icon: '🔍',
    },
    [WORKFLOW_STATES.APPROVED]: {
        en: 'Approved',
        zh: '已核准',
        badgeClass: 'bg-emerald-100 text-emerald-600',
        icon: '✅',
    },
    [WORKFLOW_STATES.REJECTED]: {
        en: 'Rejected',
        zh: '已駁回',
        badgeClass: 'bg-rose-100 text-rose-600',
        icon: '❌',
    },
    [WORKFLOW_STATES.REVISION_REQUESTED]: {
        en: 'Revision Requested',
        zh: '需修訂',
        badgeClass: 'bg-amber-100 text-amber-600',
        icon: '✏️',
    },
    [WORKFLOW_STATES.COMPLETED]: {
        en: 'Completed',
        zh: '已完成',
        badgeClass: 'bg-teal-100 text-teal-700',
        icon: '🏁',
    },
    [WORKFLOW_STATES.ARCHIVED]: {
        en: 'Archived',
        zh: '已封存',
        badgeClass: 'bg-amber-100 text-amber-600',
        icon: '🗄️',
    },
};

export function describeWorkflowState(state: WorkflowState | string | undefined | null): WorkflowStateDisplay {
    if (state && isWorkflowState(state)) {
        return WORKFLOW_STATE_DISPLAY[state];
    }
    return WORKFLOW_STATE_DISPLAY[WORKFLOW_STATES.DRAFT];
}
