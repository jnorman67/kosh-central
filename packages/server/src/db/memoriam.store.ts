import { getDb } from './database.js';

export interface Memoriam {
    enabled: boolean;
    folderSlug: string | null;
    /** Featured photo's filename within the album. Null means "use the album cover". */
    photoFileName: string | null;
    name: string;
    /** Free-form, e.g. "March 3, 1931 – August 12, 2026". */
    dates: string;
    message: string;
    updatedAt: string;
}

export interface MemoriamInput {
    enabled: boolean;
    folderSlug: string | null;
    photoFileName: string | null;
    name: string;
    dates: string;
    message: string;
}

interface MemoriamRow {
    enabled: number;
    folder_slug: string | null;
    photo_file_name: string | null;
    name: string;
    dates: string;
    message: string;
    updated_at: string;
}

export function getMemoriam(): Memoriam {
    const row = getDb().prepare('SELECT * FROM memoriam WHERE id = 1').get() as MemoriamRow;
    return {
        enabled: row.enabled === 1,
        folderSlug: row.folder_slug,
        photoFileName: row.photo_file_name,
        name: row.name,
        dates: row.dates,
        message: row.message,
        updatedAt: row.updated_at,
    };
}

export function updateMemoriam(input: MemoriamInput, userId: string): Memoriam {
    getDb()
        .prepare(
            `UPDATE memoriam
             SET enabled = ?, folder_slug = ?, photo_file_name = ?, name = ?, dates = ?, message = ?,
                 updated_at = datetime('now'), updated_by = ?
             WHERE id = 1`,
        )
        .run(
            input.enabled ? 1 : 0,
            input.folderSlug,
            input.photoFileName,
            input.name,
            input.dates,
            input.message,
            userId,
        );
    return getMemoriam();
}
