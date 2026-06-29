import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

const AUTH_KEY = 'bersn_auth';
const runtimeConfig = (globalThis as { __BERSN_ENV__?: { VITE_API_URL?: string } }).__BERSN_ENV__;
export const API_BASE_URL = runtimeConfig?.VITE_API_URL || (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000';

export function buildFingerprint(): string {
    return `${navigator.userAgent}|${navigator.language}|${navigator.platform}`;
}

export function buildJsonHeaders(): HeadersInit {
    return {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': buildFingerprint(),
    };
}

function markAuthenticated() {
    sessionStorage.setItem(AUTH_KEY, 'true');
}

export function clearAuthMarker() {
    sessionStorage.removeItem(AUTH_KEY);
}

export class AuthError extends Error {
    kind: 'invalid_credentials' | 'locked' | 'passkey_unavailable' | 'rate_limited' | 'network' | 'not_supported' | 'server';
    code?: string;
    retryAfterSeconds?: number;

    constructor(
        kind: 'invalid_credentials' | 'locked' | 'passkey_unavailable' | 'rate_limited' | 'network' | 'not_supported' | 'server',
        message: string,
        code?: string,
        retryAfterSeconds?: number,
    ) {
        super(message);
        this.kind = kind;
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

export interface AuthenticatedUser {
    id: string;
    is_first_login: boolean;
    role: string;
    username: string;
}

export interface AuthResult {
    must_change_password: boolean;
    user: AuthenticatedUser;
    role?: string;
    permissions?: string[];
}

export interface SessionContext {
    user: AuthenticatedUser;
    role: string;
    permissions: string[];
}

async function parseApiResponse(response: Response): Promise<any> {
    return response.json().catch(() => ({}));
}

function mapAuthFailure(body: any): never {
    clearAuthMarker();

    if (body?.error_code === 'BERSN_AUTH_ACCOUNT_LOCKED') {
        throw new AuthError(
            'locked',
            'Account temporarily locked due to repeated failed sign-in attempts.',
            body?.error_code,
            Number(body?.details?.retry_after_seconds || 0) || undefined,
        );
    }

    if (body?.error_code === 'BERSN_AUTH_RATE_LIMITED') {
        throw new AuthError(
            'rate_limited',
            'Too many login attempts. Please try again later.',
            body?.error_code,
            Number(body?.details?.retry_after_seconds || 0) || undefined,
        );
    }

    if (
        body?.error_code === 'BERSN_AUTH_INVALID_CREDENTIALS'
        || body?.error_code === 'BERSN_AUTH_PASSKEY_INVALID'
    ) {
        throw new AuthError('invalid_credentials', 'Invalid username, password, or passkey.', body?.error_code);
    }

    if (body?.error_code === 'BERSN_AUTH_PASSKEY_UNAVAILABLE') {
        throw new AuthError('passkey_unavailable', 'Passkey sign-in is not available for this account.', body?.error_code);
    }

    throw new AuthError('server', body?.message || 'Unexpected authentication error. Please review the browser console and API logs.', body?.error_code);
}

export async function login(username: string, password: string, rememberMe = false): Promise<AuthResult> {
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify({
                username,
                password,
                remember_me: rememberMe,
            }),
        });
    } catch {
        throw new AuthError('network', 'Login request failed. Check the API URL, CORS policy, and network reachability.');
    }

    const body = await parseApiResponse(response);
    if (response.ok && body?.ok === true) {
        markAuthenticated();
        return body as AuthResult;
    }

    return mapAuthFailure(body);
}

export async function loginWithPasskey(username: string, rememberMe = false): Promise<AuthResult> {
    if (!window.PublicKeyCredential) {
        throw new AuthError('not_supported', 'This browser does not support passkeys.', 'BERSN_AUTH_PASSKEY_NOT_SUPPORTED');
    }

    let optionsResponse: Response;
    try {
        optionsResponse = await fetch(`${API_BASE_URL}/api/auth/webauthn/login/options`, {
            method: 'POST',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify({ username }),
        });
    } catch {
        throw new AuthError('network', 'Passkey sign-in could not reach the API.');
    }

    const optionsBody = await parseApiResponse(optionsResponse);
    if (!optionsResponse.ok || optionsBody?.ok !== true) {
        return mapAuthFailure(optionsBody);
    }

    let authenticationResponse;
    try {
        authenticationResponse = await startAuthentication({ optionsJSON: optionsBody.options });
    } catch (error) {
        throw new AuthError(
            'passkey_unavailable',
            error instanceof Error ? error.message : 'Passkey sign-in was cancelled or failed on this device.',
            'BERSN_AUTH_PASSKEY_UNAVAILABLE',
        );
    }

    let verifyResponse: Response;
    try {
        verifyResponse = await fetch(`${API_BASE_URL}/api/auth/webauthn/login/verify`, {
            method: 'POST',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify({
                username,
                remember_me: rememberMe,
                response: authenticationResponse,
            }),
        });
    } catch {
        throw new AuthError('network', 'Passkey verification request failed. Check API reachability.');
    }

    const verifyBody = await parseApiResponse(verifyResponse);
    if (verifyResponse.ok && verifyBody?.ok === true) {
        markAuthenticated();
        return verifyBody as AuthResult;
    }

    return mapAuthFailure(verifyBody);
}

export async function registerPasskey(): Promise<void> {
    if (!window.PublicKeyCredential) {
        throw new AuthError('not_supported', 'This browser does not support passkeys.', 'BERSN_AUTH_PASSKEY_NOT_SUPPORTED');
    }

    let optionsResponse: Response;
    try {
        optionsResponse = await fetch(`${API_BASE_URL}/api/auth/webauthn/register/options`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'X-Device-Fingerprint': buildFingerprint(),
            },
        });
    } catch {
        throw new AuthError('network', 'Passkey registration could not reach the API.', 'BERSN_API_NETWORK_ERROR');
    }

    const optionsBody = await parseApiResponse(optionsResponse);
    if (!optionsResponse.ok || optionsBody?.ok !== true) {
        throw new AuthError('server', optionsBody?.message || 'Passkey registration could not be started.', optionsBody?.error_code);
    }

    let registrationResponse;
    try {
        registrationResponse = await startRegistration({ optionsJSON: optionsBody.options });
    } catch (error) {
        throw new AuthError(
            'passkey_unavailable',
            error instanceof Error ? error.message : 'Passkey registration was cancelled or failed on this device.',
            'BERSN_AUTH_PASSKEY_UNAVAILABLE',
        );
    }

    let verifyResponse: Response;
    try {
        verifyResponse = await fetch(`${API_BASE_URL}/api/auth/webauthn/register/verify`, {
            method: 'POST',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify({
                response: registrationResponse,
            }),
        });
    } catch {
        throw new AuthError('network', 'Passkey registration verification failed. Check API reachability.', 'BERSN_API_NETWORK_ERROR');
    }

    const verifyBody = await parseApiResponse(verifyResponse);
    if (!verifyResponse.ok || verifyBody?.ok !== true) {
        if (verifyBody?.error_code === 'BERSN_AUTH_PASSKEY_VERIFICATION_REQUIRED') {
            throw new AuthError(
                'passkey_unavailable',
                'This device could not complete verified passkey registration. You can keep using your password, or try another authenticator.',
                verifyBody?.error_code,
            );
        }

        if (verifyBody?.error_code === 'BERSN_AUTH_PASSKEY_EXISTS') {
            return;
        }

        throw new AuthError('server', verifyBody?.message || 'Passkey registration failed.', verifyBody?.error_code);
    }
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
    const session = await getCurrentSession();
    return session.user;
}

export async function getCurrentSession(): Promise<SessionContext> {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'X-Device-Fingerprint': buildFingerprint(),
        },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) {
        clearAuthMarker();
        throw new Error('Not authenticated');
    }
    markAuthenticated();
    return {
        user: body.user as AuthenticatedUser,
        role: String(body.role || body.user?.role || ''),
        permissions: Array.isArray(body.permissions) ? body.permissions.map(String) : [],
    };
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
            method: 'POST',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
            }),
        });
    } catch {
        throw new AuthError('network', 'Password change request failed. Check the API URL and network reachability.', 'BERSN_API_NETWORK_ERROR');
    }

    const body = await parseApiResponse(response);
    if (response.ok && body?.ok === true) {
        clearAuthMarker();
        return;
    }

    clearAuthMarker();
    if (body?.error_code === 'BERSN_AUTH_PASSWORD_WEAK' && Array.isArray(body?.details?.password_requirements)) {
        throw new AuthError('server', body.details.password_requirements.join(' '), body?.error_code);
    }

    if (body?.error_code === 'BERSN_AUTH_TOKEN_INVALID' || body?.error_code === 'BERSN_AUTH_INVALID_SESSION') {
        throw new AuthError(
            'server',
            'Your session expired. Please sign in again with your current temporary password, then update it.',
            body?.error_code,
        );
    }

    throw new AuthError('server', body?.message || 'Password change failed. Please try again.', body?.error_code);
}

export async function logout(): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'X-Device-Fingerprint': buildFingerprint(),
            },
        });
    } finally {
        clearAuthMarker();
    }
}

export function hasAuthMarker(): boolean {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
}
