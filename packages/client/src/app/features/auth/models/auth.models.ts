export interface AuthUser {
    id: string;
    email: string;
    displayName: string;
    role: 'admin' | 'user';
}
