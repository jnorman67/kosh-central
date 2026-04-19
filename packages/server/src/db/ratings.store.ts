import { getDb } from './database.js';

export interface StoredRating {
    photoId: string;
    userId: string;
    rating: number;
    updatedAt: string;
}

interface RatingRow {
    photo_id: string;
    user_id: string;
    rating: number;
    updated_at: string;
}

function rowToRating(row: RatingRow): StoredRating {
    return {
        photoId: row.photo_id,
        userId: row.user_id,
        rating: row.rating,
        updatedAt: row.updated_at,
    };
}

export function getRating(photoId: string, userId: string): StoredRating | undefined {
    const row = getDb()
        .prepare('SELECT * FROM photo_ratings WHERE photo_id = ? AND user_id = ?')
        .get(photoId, userId) as RatingRow | undefined;
    return row ? rowToRating(row) : undefined;
}

export function getRatingsForPhoto(photoId: string): StoredRating[] {
    const rows = getDb()
        .prepare('SELECT * FROM photo_ratings WHERE photo_id = ?')
        .all(photoId) as RatingRow[];
    return rows.map(rowToRating);
}

/**
 * Fetch the current user's rating for each photo id, as a Map keyed by photo id.
 * Photos with no rating are absent from the map.
 */
export function getRatingsByUserForPhotos(userId: string, photoIds: string[]): Map<string, number> {
    const map = new Map<string, number>();
    if (photoIds.length === 0) return map;
    const placeholders = photoIds.map(() => '?').join(',');
    const rows = getDb()
        .prepare(`SELECT photo_id, rating FROM photo_ratings WHERE user_id = ? AND photo_id IN (${placeholders})`)
        .all(userId, ...photoIds) as { photo_id: string; rating: number }[];
    for (const row of rows) map.set(row.photo_id, row.rating);
    return map;
}

export function setRating(photoId: string, userId: string, rating: number): StoredRating {
    getDb()
        .prepare(
            `INSERT INTO photo_ratings (photo_id, user_id, rating, updated_at)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(photo_id, user_id) DO UPDATE SET
                 rating = excluded.rating,
                 updated_at = excluded.updated_at`,
        )
        .run(photoId, userId, rating);
    return getRating(photoId, userId)!;
}

export interface FavoritePhotoRow {
    photoId: string;
    fileName: string;
    mimeType: string;
    contentHash: string;
    rating: number;
    updatedAt: string;
}

/**
 * Paginated list of a user's rated photos (rating > 0), ordered by rating
 * descending then most recently updated. Returns joined photo metadata so the
 * caller doesn't have to round-trip to the photos store.
 */
export function getFavoritePhotosForUser(
    userId: string,
    offset: number,
    limit: number,
): { rows: FavoritePhotoRow[]; total: number } {
    const db = getDb();
    const totalRow = db
        .prepare('SELECT COUNT(*) AS c FROM photo_ratings WHERE user_id = ? AND rating > 0')
        .get(userId) as { c: number };
    const rows = db
        .prepare(
            `SELECT p.id AS photo_id, p.file_name, p.mime_type, p.content_hash,
                    r.rating, r.updated_at
             FROM photo_ratings r
             JOIN photos p ON p.id = r.photo_id
             WHERE r.user_id = ? AND r.rating > 0
             ORDER BY r.rating DESC, r.updated_at DESC, p.file_name ASC
             LIMIT ? OFFSET ?`,
        )
        .all(userId, limit, offset) as Array<{
        photo_id: string;
        file_name: string;
        mime_type: string;
        content_hash: string;
        rating: number;
        updated_at: string;
    }>;
    return {
        total: totalRow.c,
        rows: rows.map((r) => ({
            photoId: r.photo_id,
            fileName: r.file_name,
            mimeType: r.mime_type,
            contentHash: r.content_hash,
            rating: r.rating,
            updatedAt: r.updated_at,
        })),
    };
}

export function deleteRating(photoId: string, userId: string): boolean {
    const result = getDb()
        .prepare('DELETE FROM photo_ratings WHERE photo_id = ? AND user_id = ?')
        .run(photoId, userId);
    return result.changes > 0;
}
