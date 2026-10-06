import { getDb } from '../db/database.js';
import { createUser, type Role, type StoredUser } from './users.store.js';

/** A pending registration. Only invited emails can register; the row is consumed on registration. */
export interface Invite {
    email: string;
    role: Role;
    createdAt: string;
}

interface InviteRow {
    email: string;
    role: string;
    created_at: string;
}

function rowToInvite(row: InviteRow): Invite {
    return { email: row.email, role: row.role as Role, createdAt: row.created_at };
}

export function listInvites(): Invite[] {
    return (getDb().prepare('SELECT * FROM invites ORDER BY created_at DESC, email').all() as InviteRow[]).map(
        rowToInvite,
    );
}

/** Case-insensitive (the column is COLLATE NOCASE). */
export function findInvite(email: string): Invite | undefined {
    const row = getDb().prepare('SELECT * FROM invites WHERE email = ?').get(email) as InviteRow | undefined;
    return row ? rowToInvite(row) : undefined;
}

export function createInvite(email: string, role: Role, createdBy: string): Invite {
    getDb().prepare('INSERT INTO invites (email, role, created_by) VALUES (?, ?, ?)').run(email, role, createdBy);
    return findInvite(email)!;
}

export function updateInviteRole(email: string, role: Role): Invite | undefined {
    getDb().prepare('UPDATE invites SET role = ? WHERE email = ?').run(role, email);
    return findInvite(email);
}

/** Returns false if there was no such invite. */
export function deleteInvite(email: string): boolean {
    return getDb().prepare('DELETE FROM invites WHERE email = ?').run(email).changes > 0;
}

/** Create the user and consume their invite atomically, so an invite can't be used twice. */
export function acceptInvite(user: Omit<StoredUser, 'disabledAt'>): void {
    getDb().transaction(() => {
        createUser(user);
        deleteInvite(user.email);
    })();
}
