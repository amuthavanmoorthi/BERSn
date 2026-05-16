/**
 * Route-level guards used by App.tsx to enforce authentication and
 * permission rules at navigation time. They are the front-end
 * companion to the backend middleware in
 * Backend/src/middleware/{requireAuth,requirePermission}.ts — the
 * server remains the single source of truth, but these guards ensure
 * the SPA never even renders a privileged page for an unauthorised
 * user (no flicker of admin tools before a 403).
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useSession } from '../context/SessionContext';
import { Permission, Role } from '../services/rbacPolicy';
import { ROUTE_PATHS } from './paths';

interface GateProps {
    children: React.ReactNode;
}

interface FullScreenStatusProps {
    label: string;
}

const FullScreenStatus: React.FC<FullScreenStatusProps> = ({ label }) => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-emerald-50 to-cyan-50 text-slate-600">
        {label}
    </div>
);

/**
 * Blocks the rendered element until the session has finished loading
 * and an authenticated user is present. Unauthenticated visitors are
 * redirected to `/login` with the originally-requested path stored on
 * `location.state` so we can hop back after a successful sign-in.
 */
export const RequireAuth: React.FC<GateProps> = ({ children }) => {
    const session = useSession();
    const location = useLocation();

    if (session.isLoading) {
        return <FullScreenStatus label="Checking session..." />;
    }

    if (!session.user) {
        return (
            <Navigate
                to={ROUTE_PATHS.LOGIN}
                replace
                state={{ from: location.pathname + location.search }}
            />
        );
    }

    return <>{children}</>;
};

interface RequirePermissionProps extends GateProps {
    permission?: Permission;
    anyOf?: readonly Permission[];
}

/**
 * Requires a logged-in user to hold the named permission (or at least
 * one of the `anyOf` permissions). On miss, redirect to the dedicated
 * `/unauthorized` page so the user gets clear feedback instead of an
 * abrupt logout.
 */
export const RequirePermission: React.FC<RequirePermissionProps> = ({
    permission,
    anyOf,
    children,
}) => {
    const session = useSession();

    if (session.isLoading) {
        return <FullScreenStatus label="Checking session..." />;
    }

    if (!session.user) {
        return <Navigate to={ROUTE_PATHS.LOGIN} replace />;
    }

    let granted = true;
    if (permission) {
        granted = session.hasPermission(permission);
    } else if (anyOf && anyOf.length > 0) {
        granted = session.hasAnyPermission(...anyOf);
    }

    if (!granted) {
        return <Navigate to={ROUTE_PATHS.UNAUTHORIZED} replace />;
    }

    return <>{children}</>;
};

interface RequireRoleProps extends GateProps {
    role: Role;
}

/** Strict role match — useful when several permissions overlap but only
 *  a single role should ever see a given page (e.g. admin-only system
 *  configuration screens). Falls back to `/unauthorized` on miss.
 */
export const RequireRole: React.FC<RequireRoleProps> = ({ role, children }) => {
    const session = useSession();

    if (session.isLoading) {
        return <FullScreenStatus label="Checking session..." />;
    }

    if (!session.user) {
        return <Navigate to={ROUTE_PATHS.LOGIN} replace />;
    }

    if (!session.isRole(role)) {
        return <Navigate to={ROUTE_PATHS.UNAUTHORIZED} replace />;
    }

    return <>{children}</>;
};
