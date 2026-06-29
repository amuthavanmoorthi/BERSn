/**
 * Canonical URL paths for every navigable page in the BERSn SPA.
 * Centralised so route guards, sidebar links, and view-state synchronisation
 * all share the same vocabulary (no string typos drifting between files).
 *
 * The legacy view-state names ('login' / 'dashboard' / etc.) are preserved
 * inside App.tsx so the bulk of the rendering logic does not need to be
 * rewritten; useViewRouter() translates between path and view.
 */

export const ROUTE_PATHS = {
    LOGIN: '/login',
    CHANGE_PASSWORD: '/change-password',
    DASHBOARD: '/dashboard',
    OVERVIEW: '/overview',
    ACCOUNTS: '/accounts',
    PROJECT_WORKSPACE: '/projects/:projectId',
    UNAUTHORIZED: '/unauthorized',
} as const;

export function buildProjectWorkspacePath(projectId: string): string {
    return `/projects/${encodeURIComponent(projectId)}`;
}

export type AppView =
    | 'login'
    | 'change-password'
    | 'dashboard'
    | 'workspace'
    | 'accounts'
    | 'overview';
