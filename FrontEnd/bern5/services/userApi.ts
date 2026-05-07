import type { ManagedUserCreateInput } from '../types/managedUser';

import type { User } from '../types/user';
import { API_BASE_URL, buildFingerprint, buildJsonHeaders } from './authApi';

interface UserApiResponse<T> {
    ok: boolean;
    user?: T;
    users?: T[];
    message?: string;
    details?: {
        field_errors?: Record<string, string[]>;
    };
    delivery_mode?: 'smtp' | 'log';
    delivery_reason?: 'smtp_enabled' | 'log_only_enabled' | 'smtp_not_configured';
}

export class UserApiError extends Error {
    fieldErrors?: Record<string, string[]>;

    constructor(message: string, fieldErrors?: Record<string, string[]>) {
        super(message);
        this.fieldErrors = fieldErrors;
    }
}

async function parseResponse<T>(response: Response): Promise<UserApiResponse<T>> {
    return response.json().catch(() => ({ ok: false }));
}

function assertSuccess<T>(body: UserApiResponse<T>, fallbackMessage: string): never {
    throw new UserApiError(body.message || fallbackMessage, body.details?.field_errors);
}

export async function getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'X-Device-Fingerprint': buildFingerprint(),
        },
    });
    const body = await parseResponse<User>(response);
    if (response.ok && body.ok && Array.isArray(body.users)) {
        return body.users;
    }
    return assertSuccess(body, 'Failed to load users.');
}

export async function createUserAccount(input: ManagedUserCreateInput): Promise<{
    deliveryMode: 'smtp' | 'log';
    deliveryReason: 'smtp_enabled' | 'log_only_enabled' | 'smtp_not_configured';
    user: User;
}> {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        credentials: 'include',
        headers: buildJsonHeaders(),
        body: JSON.stringify(input),
    });
    const body = await parseResponse<User>(response);
    if (response.ok && body.ok && body.user) {
        return {
            user: body.user,
            deliveryMode: body.delivery_mode || 'smtp',
            deliveryReason: body.delivery_reason || 'smtp_enabled',
        };
    }
    return assertSuccess(body, 'Failed to create account.');
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: buildJsonHeaders(),
        body: JSON.stringify({ is_active: isActive }),
    });
    const body = await parseResponse<User>(response);
    if (response.ok && body.ok && body.user) {
        return body.user;
    }
    return assertSuccess(body, 'Failed to update account status.');
}
