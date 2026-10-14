export type Role = 'admin' | 'user';

export interface AdminUser {
    id: string;
    email: string;
    displayName: string;
    role: Role;
    createdAt: string;
    /** Set when an admin revoked access; null for active accounts. */
    disabledAt: string | null;
    /** False for people who joined by invite link and only sign in by link. */
    hasPassword: boolean;
}

/** A pending registration. Removed automatically once the person registers. */
export interface Invite {
    email: string;
    role: Role;
    createdAt: string;
}

/** A one-time link token, turned into /link/<token> (sign in) or /join/<token> (invite). */
export interface CreatedLink {
    token: string;
    expiresAt: string;
}

export interface AdminUsersResponse {
    users: AdminUser[];
    invites: Invite[];
}

export interface UserUpdate {
    displayName?: string;
    email?: string;
    role?: Role;
    disabled?: boolean;
}
