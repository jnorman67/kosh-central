import crypto from 'node:crypto';
import { getDb } from './database.js';

/** Whether a gallery shows photos of any of its people, or only photos with all of them together. */
export const GALLERY_MATCH_MODES = ['any', 'all'] as const;
export type GalleryMatchMode = (typeof GALLERY_MATCH_MODES)[number];

export function isGalleryMatchMode(value: unknown): value is GalleryMatchMode {
    return typeof value === 'string' && (GALLERY_MATCH_MODES as readonly string[]).includes(value);
}

export interface GalleryPerson {
    id: string;
    fullName: string;
    nickname: string | null;
}

/** A user's own gallery of the photos tagged with chosen people, gathered from every album. */
export interface StoredGallery {
    id: string;
    userId: string;
    name: string;
    matchMode: GalleryMatchMode;
    /** In the order the user listed them. */
    persons: GalleryPerson[];
    createdAt: string;
    updatedAt: string;
}

export interface GalleryInput {
    name: string;
    matchMode: GalleryMatchMode;
    personIds: string[];
}

interface GalleryRow {
    id: string;
    user_id: string;
    name: string;
    match_mode: GalleryMatchMode;
    created_at: string;
    updated_at: string;
}

function getGalleryPersons(galleryId: string): GalleryPerson[] {
    return getDb()
        .prepare(
            `SELECT p.id, p.full_name AS fullName, p.nickname
             FROM person_gallery_persons g
             JOIN persons p ON p.id = g.person_id
             WHERE g.gallery_id = ?
             ORDER BY g.position`,
        )
        .all(galleryId) as GalleryPerson[];
}

function rowToGallery(row: GalleryRow): StoredGallery {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        matchMode: row.match_mode,
        persons: getGalleryPersons(row.id),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function replacePersons(galleryId: string, personIds: string[]): void {
    const db = getDb();
    db.prepare('DELETE FROM person_gallery_persons WHERE gallery_id = ?').run(galleryId);
    const insert = db.prepare('INSERT INTO person_gallery_persons (gallery_id, person_id, position) VALUES (?, ?, ?)');
    personIds.forEach((personId, i) => insert.run(galleryId, personId, i));
}

/** The user's galleries, by name. */
export function listGalleriesForUser(userId: string): StoredGallery[] {
    const rows = getDb()
        .prepare('SELECT * FROM person_galleries WHERE user_id = ? ORDER BY name COLLATE NOCASE, created_at')
        .all(userId) as GalleryRow[];
    return rows.map(rowToGallery);
}

/** A gallery, only if it belongs to the given user: galleries are private to whoever made them. */
export function findGalleryForUser(id: string, userId: string): StoredGallery | undefined {
    const row = getDb().prepare('SELECT * FROM person_galleries WHERE id = ? AND user_id = ?').get(id, userId) as
        | GalleryRow
        | undefined;
    return row ? rowToGallery(row) : undefined;
}

export function createGallery(userId: string, input: GalleryInput): StoredGallery {
    const db = getDb();
    const id = crypto.randomUUID();
    db.transaction(() => {
        db.prepare('INSERT INTO person_galleries (id, user_id, name, match_mode) VALUES (?, ?, ?, ?)').run(
            id,
            userId,
            input.name,
            input.matchMode,
        );
        replacePersons(id, input.personIds);
    })();
    return findGalleryForUser(id, userId)!;
}

/** Returns undefined when the gallery doesn't exist or isn't the user's. */
export function updateGallery(id: string, userId: string, input: GalleryInput): StoredGallery | undefined {
    const db = getDb();
    const updated = db.transaction(() => {
        const result = db
            .prepare(
                `UPDATE person_galleries SET name = ?, match_mode = ?, updated_at = datetime('now')
                 WHERE id = ? AND user_id = ?`,
            )
            .run(input.name, input.matchMode, id, userId);
        if (result.changes === 0) return false;
        replacePersons(id, input.personIds);
        return true;
    })();
    return updated ? findGalleryForUser(id, userId) : undefined;
}

export function deleteGallery(id: string, userId: string): boolean {
    return getDb().prepare('DELETE FROM person_galleries WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
}
