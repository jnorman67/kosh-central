import crypto from 'node:crypto';
import { getDb } from './database.js';

export type SeriesSource = 'manual' | 'folder';

export interface StoredSeries {
    id: string;
    name: string;
    description: string | null;
    source: SeriesSource;
    sourceKey: string | null;
    createdAt: string;
    createdBy: string | null;
}

export interface StoredSeriesMember {
    seriesId: string;
    photoId: string;
    position: number;
    addedAt: string;
}

interface SeriesRow {
    id: string;
    name: string;
    description: string | null;
    source: SeriesSource;
    source_key: string | null;
    created_at: string;
    created_by: string | null;
}

interface MemberRow {
    series_id: string;
    photo_id: string;
    position: number;
    added_at: string;
}

function rowToSeries(row: SeriesRow): StoredSeries {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        source: row.source,
        sourceKey: row.source_key,
        createdAt: row.created_at,
        createdBy: row.created_by,
    };
}

function rowToMember(row: MemberRow): StoredSeriesMember {
    return {
        seriesId: row.series_id,
        photoId: row.photo_id,
        position: row.position,
        addedAt: row.added_at,
    };
}

export function listSeries(): StoredSeries[] {
    const rows = getDb().prepare('SELECT * FROM photo_series ORDER BY name').all() as SeriesRow[];
    return rows.map(rowToSeries);
}

export function findSeriesById(id: string): StoredSeries | undefined {
    const row = getDb().prepare('SELECT * FROM photo_series WHERE id = ?').get(id) as SeriesRow | undefined;
    return row ? rowToSeries(row) : undefined;
}

export function createSeries(name: string, description: string | null, createdBy: string | null): StoredSeries {
    const id = crypto.randomUUID();
    getDb()
        .prepare('INSERT INTO photo_series (id, name, description, created_by) VALUES (?, ?, ?, ?)')
        .run(id, name, description, createdBy);
    return findSeriesById(id)!;
}

export function updateSeries(id: string, name: string, description: string | null): StoredSeries | undefined {
    const result = getDb()
        .prepare('UPDATE photo_series SET name = ?, description = ? WHERE id = ?')
        .run(name, description, id);
    if (result.changes === 0) return undefined;
    return findSeriesById(id);
}

export function deleteSeries(id: string): boolean {
    const result = getDb().prepare('DELETE FROM photo_series WHERE id = ?').run(id);
    return result.changes > 0;
}

export function getSeriesMembers(seriesId: string): StoredSeriesMember[] {
    const rows = getDb()
        .prepare('SELECT * FROM photo_series_members WHERE series_id = ? ORDER BY position')
        .all(seriesId) as MemberRow[];
    return rows.map(rowToMember);
}

export function addSeriesMember(seriesId: string, photoId: string, position: number): StoredSeriesMember {
    getDb()
        .prepare('INSERT OR IGNORE INTO photo_series_members (series_id, photo_id, position) VALUES (?, ?, ?)')
        .run(seriesId, photoId, position);
    const row = getDb()
        .prepare('SELECT * FROM photo_series_members WHERE series_id = ? AND photo_id = ?')
        .get(seriesId, photoId) as MemberRow;
    return rowToMember(row);
}

export function removeSeriesMember(seriesId: string, photoId: string): boolean {
    const result = getDb()
        .prepare('DELETE FROM photo_series_members WHERE series_id = ? AND photo_id = ?')
        .run(seriesId, photoId);
    return result.changes > 0;
}

/**
 * Find or create a folder-derived series keyed by the photo's `folderName`.
 * The name is set on insert only — if a user later renames the series, a
 * subsequent re-import won't overwrite their edit.
 */
export function upsertFolderSeries(folderName: string, displayName: string): StoredSeries {
    const db = getDb();
    const existing = db
        .prepare('SELECT * FROM photo_series WHERE source_key = ?')
        .get(folderName) as SeriesRow | undefined;
    if (existing) return rowToSeries(existing);

    const id = crypto.randomUUID();
    db.prepare(
        `INSERT INTO photo_series (id, name, description, source, source_key)
         VALUES (?, ?, NULL, 'folder', ?)`,
    ).run(id, displayName, folderName);
    return findSeriesById(id)!;
}

/** Get all series that a photo belongs to. */
export function getSeriesForPhoto(photoId: string): StoredSeries[] {
    const rows = getDb()
        .prepare(
            `SELECT ps.* FROM photo_series ps
             JOIN photo_series_members psm ON ps.id = psm.series_id
             WHERE psm.photo_id = ?
             ORDER BY ps.name`,
        )
        .all(photoId) as SeriesRow[];
    return rows.map(rowToSeries);
}
