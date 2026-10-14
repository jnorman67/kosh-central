import type { AdminUser, AdminUsersResponse, CreatedLink, Invite, Role, UserUpdate } from '@/app/features/admin/models/user.models';
import { apiFetch } from '@/lib/api-client';

export class AdminUsersService {
    async list(): Promise<AdminUsersResponse> {
        return apiFetch<AdminUsersResponse>('/api/admin/users');
    }

    async updateUser(id: string, update: UserUpdate): Promise<AdminUser> {
        return apiFetch<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
        });
    }

    async createLoginLink(id: string): Promise<CreatedLink> {
        return apiFetch<CreatedLink>(`/api/admin/users/${encodeURIComponent(id)}/login-link`, { method: 'POST' });
    }

    async createInviteLink(email: string): Promise<CreatedLink> {
        return apiFetch<CreatedLink>(`/api/admin/users/invites/${encodeURIComponent(email)}/link`, { method: 'POST' });
    }

    async createInvite(email: string, role: Role): Promise<Invite> {
        return apiFetch<Invite>('/api/admin/users/invites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role }),
        });
    }

    async updateInvite(email: string, role: Role): Promise<Invite> {
        return apiFetch<Invite>(`/api/admin/users/invites/${encodeURIComponent(email)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
        });
    }

    async deleteInvite(email: string): Promise<void> {
        await apiFetch<void>(`/api/admin/users/invites/${encodeURIComponent(email)}`, { method: 'DELETE' });
    }
}
