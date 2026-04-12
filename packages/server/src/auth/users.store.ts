import { getDb } from '../db/database.js';
import type { Role } from '../config/invites.config.js';

export interface StoredUser {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
    role: Role;
    createdAt: string;
}

interface UserRow {
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
    role: string;
    created_at: string;
}

function rowToUser(row: UserRow): StoredUser {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        passwordHash: row.password_hash,
        role: row.role as Role,
        createdAt: row.created_at,
    };
}

export function findUserByEmail(email: string): StoredUser | undefined {
    const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
    return row ? rowToUser(row) : undefined;
}

export function findUserById(id: string): StoredUser | undefined {
    const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? rowToUser(row) : undefined;
}

export function createUser(user: StoredUser): void {
    getDb()
        .prepare('INSERT INTO users (id, email, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(user.id, user.email, user.displayName, user.passwordHash, user.role, user.createdAt);
}
