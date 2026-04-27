import crypto from 'node:crypto';
import { getDb } from './database.js';
import { getBundleIdForPhoto } from './photos.store.js';

export type MentionType = 'user' | 'person';

export interface StoredMention {
    commentId: string;
    mentionType: MentionType;
    mentionedId: string;
}

export interface StoredComment {
    id: string;
    photoId: string;
    authorId: string;
    authorDisplayName: string;
    body: string;
    createdAt: string;
    editedAt: string | null;
    mentions: StoredMention[];
}

export interface MentionInput {
    mentionType: MentionType;
    mentionedId: string;
}

interface CommentRow {
    id: string;
    bundle_id: string;
    author_id: string;
    author_display_name: string;
    body: string;
    created_at: string;
    edited_at: string | null;
}

interface MentionRow {
    comment_id: string;
    mention_type: string;
    mentioned_id: string;
}

function rowToComment(row: CommentRow, photoId: string, mentions: StoredMention[]): StoredComment {
    return {
        id: row.id,
        photoId,
        authorId: row.author_id,
        authorDisplayName: row.author_display_name,
        body: row.body,
        createdAt: row.created_at,
        editedAt: row.edited_at,
        mentions,
    };
}

function rowToMention(row: MentionRow): StoredMention {
    return {
        commentId: row.comment_id,
        mentionType: row.mention_type as MentionType,
        mentionedId: row.mentioned_id,
    };
}

function fetchMentionsForComments(commentIds: string[]): Map<string, StoredMention[]> {
    const map = new Map<string, StoredMention[]>();
    if (commentIds.length === 0) return map;
    const ph = commentIds.map(() => '?').join(',');
    const rows = getDb()
        .prepare(`SELECT comment_id, mention_type, mentioned_id FROM comment_mentions WHERE comment_id IN (${ph})`)
        .all(...commentIds) as MentionRow[];
    for (const row of rows) {
        const m = rowToMention(row);
        if (!map.has(m.commentId)) map.set(m.commentId, []);
        map.get(m.commentId)!.push(m);
    }
    return map;
}

function insertMentions(commentId: string, mentions: MentionInput[]): void {
    if (mentions.length === 0) return;
    const stmt = getDb().prepare(
        'INSERT INTO comment_mentions (comment_id, mention_type, mentioned_id) VALUES (?, ?, ?)',
    );
    for (const m of mentions) {
        stmt.run(commentId, m.mentionType, m.mentionedId);
    }
}

function validateMentions(mentions: MentionInput[]): void {
    const db = getDb();
    for (const m of mentions) {
        const table = m.mentionType === 'user' ? 'users' : 'persons';
        const exists = db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(m.mentionedId);
        if (!exists) {
            throw new Error(`Invalid mention: ${m.mentionType} ${m.mentionedId} not found`);
        }
    }
}

export function listCommentsForPhoto(photoId: string): StoredComment[] {
    const bundleId = getBundleIdForPhoto(photoId);
    if (!bundleId) return [];
    const rows = getDb()
        .prepare(
            `SELECT c.id, c.bundle_id, c.author_id, u.display_name AS author_display_name,
                    c.body, c.created_at, c.edited_at
             FROM photo_comments c
             JOIN users u ON u.id = c.author_id
             WHERE c.bundle_id = ?
             ORDER BY c.created_at ASC`,
        )
        .all(bundleId) as CommentRow[];

    const mentionMap = fetchMentionsForComments(rows.map((r) => r.id));
    return rows.map((r) => rowToComment(r, photoId, mentionMap.get(r.id) ?? []));
}

export function findCommentById(id: string): StoredComment | undefined {
    const row = getDb()
        .prepare(
            `SELECT c.id, c.bundle_id, c.author_id, u.display_name AS author_display_name,
                    c.body, c.created_at, c.edited_at,
                    (SELECT ph.id FROM photos ph
                     WHERE ph.bundle_id = c.bundle_id AND ph.is_preferred = 1
                     ORDER BY (ph.side = 'front') DESC
                     LIMIT 1) AS representative_photo_id
             FROM photo_comments c
             JOIN users u ON u.id = c.author_id
             WHERE c.id = ?`,
        )
        .get(id) as (CommentRow & { representative_photo_id: string | null }) | undefined;

    if (!row) return undefined;
    const mentionMap = fetchMentionsForComments([id]);
    return rowToComment(row, row.representative_photo_id ?? '', mentionMap.get(id) ?? []);
}

export function createComment(
    photoId: string,
    authorId: string,
    body: string,
    mentions: MentionInput[],
): StoredComment {
    const bundleId = getBundleIdForPhoto(photoId);
    if (!bundleId) throw new Error(`Photo ${photoId} has no bundle`);
    validateMentions(mentions);
    const id = crypto.randomUUID();
    const db = getDb();

    db.transaction(() => {
        db.prepare(
            'INSERT INTO photo_comments (id, bundle_id, author_id, body) VALUES (?, ?, ?, ?)',
        ).run(id, bundleId, authorId, body);
        insertMentions(id, mentions);
    })();

    return findCommentById(id)!;
}

export function updateComment(id: string, body: string, mentions: MentionInput[]): StoredComment {
    validateMentions(mentions);
    const db = getDb();

    db.transaction(() => {
        db.prepare(
            `UPDATE photo_comments SET body = ?, edited_at = datetime('now') WHERE id = ?`,
        ).run(body, id);
        db.prepare('DELETE FROM comment_mentions WHERE comment_id = ?').run(id);
        insertMentions(id, mentions);
    })();

    return findCommentById(id)!;
}

export function deleteComment(id: string): boolean {
    const result = getDb()
        .prepare('DELETE FROM photo_comments WHERE id = ?')
        .run(id);
    return result.changes > 0;
}
