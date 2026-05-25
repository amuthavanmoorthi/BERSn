import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
    AuthenticatedUser,
    SessionContext as ApiSessionContext,
    getCurrentSession,
} from '../services/authApi';
import {
    Permission,
    Role,
    hasAnyPermission as policyHasAny,
    hasPermission as policyHas,
    normalizeRole,
    permissionsForRole,
} from '../services/rbacPolicy';

interface SessionState {
    user: AuthenticatedUser | null;
    role: Role | null;
    permissions: readonly Permission[];
    isLoading: boolean;
    error: string | null;
}

interface SessionContextValue extends SessionState {
    refresh: () => Promise<void>;
    clear: () => void;
    hasPermission: (permission: Permission) => boolean;
    hasAnyPermission: (...permissions: Permission[]) => boolean;
    isRole: (role: Role) => boolean;
}

const EMPTY_PERMISSIONS: readonly Permission[] = [];

const initialState: SessionState = {
    user: null,
    role: null,
    permissions: EMPTY_PERMISSIONS,
    isLoading: true,
    error: null,
};

const ReactSessionContext = createContext<SessionContextValue | null>(null);

function deriveRoleAndPermissions(apiSession: ApiSessionContext): {
    role: Role;
    permissions: readonly Permission[];
} {
    const role = normalizeRole(apiSession.role || apiSession.user?.role);
    const permissions = apiSession.permissions && apiSession.permissions.length > 0
        ? (apiSession.permissions as Permission[])
        : permissionsForRole(role);
    return { role, permissions };
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<SessionState>(initialState);

    const refresh = useCallback(async () => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        try {
            const session = await getCurrentSession();
            const { role, permissions } = deriveRoleAndPermissions(session);
            setState({
                user: session.user,
                role,
                permissions,
                isLoading: false,
                error: null,
            });
        } catch (error) {
            setState({
                user: null,
                role: null,
                permissions: EMPTY_PERMISSIONS,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Not authenticated',
            });
        }
    }, []);

    const clear = useCallback(() => {
        setState({
            user: null,
            role: null,
            permissions: EMPTY_PERMISSIONS,
            isLoading: false,
            error: null,
        });
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const value = useMemo<SessionContextValue>(() => ({
        ...state,
        refresh,
        clear,
        hasPermission: (permission) => policyHas(state.permissions, permission),
        hasAnyPermission: (...permissions) => policyHasAny(state.permissions, permissions),
        isRole: (role) => state.role === role,
    }), [state, refresh, clear]);

    return (
        <ReactSessionContext.Provider value={value}>
            {children}
        </ReactSessionContext.Provider>
    );
};

export function useSession(): SessionContextValue {
    const ctx = useContext(ReactSessionContext);
    if (!ctx) {
        throw new Error('useSession must be used within <SessionProvider>');
    }
    return ctx;
}

/**
 * Render `children` only if the current user has the required permission.
 * Optional `fallback` is rendered when permission is missing — defaults
 * to `null` (the element is hidden).
 */
export const PermissionGate: React.FC<{
    permission?: Permission;
    anyOf?: Permission[];
    fallback?: React.ReactNode;
    children: React.ReactNode;
}> = ({ permission, anyOf, fallback = null, children }) => {
    const session = useSession();
    let granted = true;
    if (permission) {
        granted = session.hasPermission(permission);
    } else if (anyOf && anyOf.length > 0) {
        granted = session.hasAnyPermission(...anyOf);
    }
    return <>{granted ? children : fallback}</>;
};

export const RoleGate: React.FC<{
    role: Role;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}> = ({ role, fallback = null, children }) => {
    const session = useSession();
    return <>{session.isRole(role) ? children : fallback}</>;
};
