import type { AuthUser } from '@/app/features/auth/models/auth.models';

interface AuthResponse {
    user: AuthUser;
}

interface MessageResponse {
    message: string;
}

interface ErrorResponse {
    error: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
    const body = await res.json();
    if (!res.ok) throw new Error((body as ErrorResponse).error || 'Request failed');
    return body as T;
}

export class AuthService {
    async getMe(): Promise<AuthUser> {
        const res = await fetch('/api/auth/me');
        const body = await handleResponse<AuthResponse>(res);
        return body.user;
    }

    async login(email: string, password: string): Promise<AuthUser> {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const body = await handleResponse<AuthResponse>(res);
        return body.user;
    }

    async register(email: string, displayName: string, password: string): Promise<string> {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, displayName, password }),
        });
        const body = await handleResponse<MessageResponse>(res);
        return body.message;
    }

    async logout(): Promise<void> {
        await fetch('/api/auth/logout', { method: 'POST' });
    }
}
