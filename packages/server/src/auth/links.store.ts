import crypto from 'node:crypto';
import { getDb } from '../db/database.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOGIN_LINK_TTL_MS = 7 * DAY_MS;
const INVITE_LINK_TTL_MS = 30 * DAY_MS;

/** A freshly created link. The token is only ever known here; the table stores its hash. */
export interface CreatedLink {
    token: string;
    expiresAt: string;
}

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function createLink(target: { userId: string } | { inviteEmail: string }, ttlMs: number): CreatedLink {
    const token = crypto.randomBytes(24).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
    const db = getDb();
    db.prepare('DELETE FROM auth_links WHERE expires_at < ?').run(now.toISOString());
    db.prepare('INSERT INTO auth_links (token_hash, user_id, invite_email, expires_at) VALUES (?, ?, ?, ?)').run(
        hashToken(token),
        'userId' in target ? target.userId : null,
        'inviteEmail' in target ? target.inviteEmail : null,
        expiresAt,
    );
    return { token, expiresAt };
}

/**
 * Earlier links for the same person keep working, so copying a second link never breaks one
 * that was already sent.
 */
export function createLoginLink(userId: string): CreatedLink {
    return createLink({ userId }, LOGIN_LINK_TTL_MS);
}

export function createInviteLink(inviteEmail: string): CreatedLink {
    return createLink({ inviteEmail }, INVITE_LINK_TTL_MS);
}

interface LinkRow {
    user_id: string | null;
    invite_email: string | null;
    expires_at: string;
}

function findLink(token: string): LinkRow | undefined {
    const row = getDb()
        .prepare('SELECT user_id, invite_email, expires_at FROM auth_links WHERE token_hash = ?')
        .get(hashToken(token)) as LinkRow | undefined;
    return row && row.expires_at > new Date().toISOString() ? row : undefined;
}

/** Uses up a sign-in link. Returns its user id, or undefined if the link is unknown, used, or expired. */
export function consumeLoginLink(token: string): string | undefined {
    const row = findLink(token);
    if (!row?.user_id) return undefined;
    getDb().prepare('DELETE FROM auth_links WHERE token_hash = ?').run(hashToken(token));
    return row.user_id;
}

/**
 * The invited email an invite link is for, without using it up. Accepting the invite deletes
 * the invite, which deletes all of its links.
 */
export function findInviteLinkEmail(token: string): string | undefined {
    return findLink(token)?.invite_email ?? undefined;
}
