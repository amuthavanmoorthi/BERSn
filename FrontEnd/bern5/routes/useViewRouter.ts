/**
 * Bridges the (legacy) view-state machine inside App.tsx with the new
 * URL-driven react-router routing.
 *
 * The hook returns a `currentView` derived from the current pathname and a
 * `setCurrentView` setter that pushes the new view onto the browser
 * history. App.tsx callers continue using `setCurrentView('dashboard')`
 * unchanged — the URL update happens transparently.
 *
 * `activeProjectId` is extracted from the `/projects/:projectId` route
 * parameter so the workspace view's project identity stays in sync with
 * the URL across reloads and copy-pasted links.
 */

import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { AppView, ROUTE_PATHS, buildProjectWorkspacePath } from './paths';

interface ViewRouter {
    currentView: AppView;
    activeProjectId: string | null;
    setCurrentView: (next: AppView, options?: { projectId?: string | null; replace?: boolean }) => void;
    navigateToProject: (projectId: string) => void;
    navigateToUnauthorized: () => void;
}

function deriveViewFromPath(pathname: string): AppView {
    if (pathname.startsWith('/projects/')) return 'workspace';
    switch (pathname) {
        case ROUTE_PATHS.DASHBOARD:
            return 'dashboard';
        case ROUTE_PATHS.OVERVIEW:
            return 'overview';
        case ROUTE_PATHS.ACCOUNTS:
            return 'accounts';
        case ROUTE_PATHS.CHANGE_PASSWORD:
            return 'change-password';
        case ROUTE_PATHS.LOGIN:
            return 'login';
        default:
            return 'login';
    }
}

export function useViewRouter(): ViewRouter {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams<{ projectId?: string }>();

    const currentView = useMemo(
        () => deriveViewFromPath(location.pathname),
        [location.pathname],
    );

    const activeProjectId = params.projectId ?? null;

    const setCurrentView = useCallback<ViewRouter['setCurrentView']>((next, options) => {
        const replace = options?.replace ?? false;
        switch (next) {
            case 'login':
                navigate(ROUTE_PATHS.LOGIN, { replace });
                return;
            case 'change-password':
                navigate(ROUTE_PATHS.CHANGE_PASSWORD, { replace });
                return;
            case 'dashboard':
                navigate(ROUTE_PATHS.DASHBOARD, { replace });
                return;
            case 'overview':
                navigate(ROUTE_PATHS.OVERVIEW, { replace });
                return;
            case 'accounts':
                navigate(ROUTE_PATHS.ACCOUNTS, { replace });
                return;
            case 'workspace': {
                const projectId = options?.projectId ?? activeProjectId;
                if (!projectId) {
                    // No project context available — fall back to the project
                    // list rather than crashing on an empty :projectId.
                    navigate(ROUTE_PATHS.DASHBOARD, { replace });
                    return;
                }
                navigate(buildProjectWorkspacePath(projectId), { replace });
                return;
            }
            default:
                return;
        }
    }, [navigate, activeProjectId]);

    const navigateToProject = useCallback((projectId: string) => {
        navigate(buildProjectWorkspacePath(projectId));
    }, [navigate]);

    const navigateToUnauthorized = useCallback(() => {
        navigate(ROUTE_PATHS.UNAUTHORIZED, { replace: true });
    }, [navigate]);

    return {
        currentView,
        activeProjectId,
        setCurrentView,
        navigateToProject,
        navigateToUnauthorized,
    };
}
