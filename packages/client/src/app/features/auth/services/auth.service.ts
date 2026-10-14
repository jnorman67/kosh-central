import type { AuthUser } from '@/app/features/auth/models/auth.models';
import { apiFetch } from '@/lib/api-client';

interface AuthResponse {
    user: AuthUser;
}

interface MessageResponse {
    message: string;
}

export class AuthService {
    async getMe(): Promise<AuthUser> {
        const body = await apiFetch<AuthResponse>('/api/auth/me');
        return body.user;
    }

    async login(email: string, password: string): Promise<AuthUser> {
        const body = await apiFetch<AuthResponse>('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        return body.user;
    }

    async register(email: string, displayName: string, password: string): Promise<string> {
        const body = await apiFetch<MessageResponse>('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, displayName, password }),
        });
        return body.message;
    }

    /** Sign in with a one-time link's token. */
    async redeemLink(token: string): Promise<AuthUser> {
        const body = await apiFetch<AuthResponse>('/api/auth/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
        return body.user;
    }

    /** The invited email an invite link is for. */
    async getInviteLink(token: string): Promise<string> {
        const body = await apiFetch<{ email: string }>(`/api/auth/join/${encodeURIComponent(token)}`);
        return body.email;
    }

    /** Accept an invite link: creates the account and signs in. */
    async join(token: string, displayName: string): Promise<AuthUser> {
        const body = await apiFetch<AuthResponse>(`/api/auth/join/${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName }),
        });
        return body.user;
    }

    async logout(): Promise<void> {
        await fetch('/api/auth/logout', { method: 'POST' });
    }

    /** `currentPassword` is ignored for accounts that don't have a password yet. */
    async changePassword(currentPassword: string, newPassword: string): Promise<string> {
        const body = await apiFetch<MessageResponse>('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword }),
        });
        return body.message;
    }
}
