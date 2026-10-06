export type Role = 'admin' | 'user';

export interface AdminUser {
    id: string;
    email: string;
    displayName: string;
    role: Role;
    createdAt: string;
    /** Set when an admin revoked access; null for active accounts. */
    disabledAt: string | null;
}

/** A pending registration. Removed automatically once the person registers. */
export interface Invite {
    email: string;
    role: Role;
    createdAt: string;
}

export interface AdminUsersResponse {
    users: AdminUser[];
    invites: Invite[];
}

export interface UserUpdate {
    role?: Role;
    disabled?: boolean;
}
