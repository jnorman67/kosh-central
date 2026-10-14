export interface AuthUser {
    id: string;
    email: string;
    displayName: string;
    role: 'admin' | 'user';
    /** False for people who joined by invite link and haven't set a password. */
    hasPassword: boolean;
}
