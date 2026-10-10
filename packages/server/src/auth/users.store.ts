import { getDb } from '../db/database.js';

export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
    return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export interface StoredUser {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
    role: Role;
    createdAt: string;
    /** When an admin revoked access. Disabled users can't log in and their sessions stop working. */
    disabledAt: string | null;
}

/** What the admin users page sees: everything except the password hash. */
export type AdminUser = Omit<StoredUser, 'passwordHash'>;

interface UserRow {
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
    role: string;
    created_at: string;
    disabled_at: string | null;
}

function rowToUser(row: UserRow): StoredUser {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        passwordHash: row.password_hash,
        role: row.role as Role,
        createdAt: row.created_at,
        disabledAt: row.disabled_at,
    };
}

export function toAdminUser({ passwordHash: _passwordHash, ...rest }: StoredUser): AdminUser {
    return rest;
}

export function findUserByEmail(email: string): StoredUser | undefined {
    const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
    return row ? rowToUser(row) : undefined;
}

export function findUserById(id: string): StoredUser | undefined {
    const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? rowToUser(row) : undefined;
}

export function createUser(user: Omit<StoredUser, 'disabledAt'>): void {
    getDb()
        .prepare('INSERT INTO users (id, email, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(user.id, user.email, user.displayName, user.passwordHash, user.role, user.createdAt);
}

export function updateUserPasswordHash(id: string, passwordHash: string): void {
    getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

export function updateUserProfile(id: string, profile: { displayName?: string; email?: string }): void {
    const db = getDb();
    if (profile.displayName !== undefined) {
        db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(profile.displayName, id);
    }
    if (profile.email !== undefined) {
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(profile.email, id);
    }
}

export function updateUserRole(id: string, role: Role): void {
    getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
}

export function setUserDisabled(id: string, disabled: boolean): void {
    getDb()
        .prepare(`UPDATE users SET disabled_at = ${disabled ? "datetime('now')" : 'NULL'} WHERE id = ?`)
        .run(id);
}

export function listUsers(): { id: string; displayName: string }[] {
    return (getDb()
        .prepare('SELECT id, display_name FROM users ORDER BY display_name')
        .all() as { id: string; display_name: string }[])
        .map((r) => ({ id: r.id, displayName: r.display_name }));
}

export function listUsersForAdmin(): AdminUser[] {
    return (getDb().prepare('SELECT * FROM users ORDER BY display_name COLLATE NOCASE').all() as UserRow[]).map(
        (row) => toAdminUser(rowToUser(row)),
    );
}
