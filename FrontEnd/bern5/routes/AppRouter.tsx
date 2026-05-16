/**
 * Top-level react-router shell that maps every navigable URL to a
 * permission-gated render of <App />.
 *
 * Important: <App /> contains heavy state (Three.js scene, debounced
 * floor cache, optimisation bundle) and is mounted ONCE at the root.
 * The same instance handles every route — useViewRouter() (inside
 * App.tsx) reads the current pathname to decide which page to draw,
 * so route changes are cheap re-renders rather than full remounts.
 *
 * The wrapper Route elements are still useful because they give us a
 * declarative place to plug in RequireAuth / RequirePermission guards
 * — those guards short-circuit BEFORE App ever renders the protected
 * page, preventing flicker of privileged UI.
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import App from '../App';
import UnauthorizedPage from '../components/UnauthorizedPage';
import { PERMISSIONS } from '../services/rbacPolicy';
import { ROUTE_PATHS } from './paths';
import {
    RequireAuth,
    RequirePermission,
} from './RouteGuards';

const AppRouter: React.FC = () => (
    <BrowserRouter>
        <Routes>
            <Route path={ROUTE_PATHS.LOGIN} element={<App />} />

            <Route
                path={ROUTE_PATHS.CHANGE_PASSWORD}
                element={
                    <RequireAuth>
                        <App />
                    </RequireAuth>
                }
            />

            <Route
                path={ROUTE_PATHS.DASHBOARD}
                element={
                    <RequireAuth>
                        <App />
                    </RequireAuth>
                }
            />

            {/* Global dashboard overview — visible to any role with a
                 dashboard permission. Backend further scopes the data. */}
            <Route
                path={ROUTE_PATHS.OVERVIEW}
                element={
                    <RequireAuth>
                        <RequirePermission
                            anyOf={[
                                PERMISSIONS.DASHBOARD_GLOBAL,
                                PERMISSIONS.DASHBOARD_AGENCY,
                                PERMISSIONS.DASHBOARD_VENDOR,
                            ]}
                        >
                            <App />
                        </RequirePermission>
                    </RequireAuth>
                }
            />

            {/* User-management console — admin-only by permission, but
                 we use USER_LIST rather than role for forward-compat. */}
            <Route
                path={ROUTE_PATHS.ACCOUNTS}
                element={
                    <RequireAuth>
                        <RequirePermission permission={PERMISSIONS.USER_LIST}>
                            <App />
                        </RequirePermission>
                    </RequireAuth>
                }
            />

            <Route
                path={ROUTE_PATHS.PROJECT_WORKSPACE}
                element={
                    <RequireAuth>
                        <App />
                    </RequireAuth>
                }
            />

            <Route path={ROUTE_PATHS.UNAUTHORIZED} element={<UnauthorizedPage />} />

            {/* Root + 404 → land on the dashboard. RequireAuth will
                 bounce visitors to /login if they're not yet signed in. */}
            <Route
                path="/"
                element={<Navigate to={ROUTE_PATHS.DASHBOARD} replace />}
            />
            <Route
                path="*"
                element={<Navigate to={ROUTE_PATHS.DASHBOARD} replace />}
            />
        </Routes>
    </BrowserRouter>
);

export default AppRouter;
