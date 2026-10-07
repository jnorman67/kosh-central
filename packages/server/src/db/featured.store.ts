import { getDb } from './database.js';

export const FEATURED_THEMES = ['classic', 'memorial', 'celebration', 'vintage'] as const;
export type FeaturedTheme = (typeof FEATURED_THEMES)[number];

export function isFeaturedTheme(value: unknown): value is FeaturedTheme {
    return typeof value === 'string' && (FEATURED_THEMES as readonly string[]).includes(value);
}

/** Admin-configured highlight of a single album, shown to users right after they sign in. */
export interface FeaturedAlbumConfig {
    enabled: boolean;
    folderSlug: string | null;
    /** Featured photo's filename within the album. Null means "use the album cover". */
    photoFileName: string | null;
    theme: FeaturedTheme;
    /** Small heading above the title, e.g. "In loving memory" or "Happy 90th birthday". */
    eyebrow: string;
    title: string;
    /** Free-form line under the title, e.g. "March 3, 1931 – August 12, 2026". */
    subtitle: string;
    message: string;
    /** Label for the "see more photos" button. Empty means the client default. */
    buttonLabel: string;
    /** People whose tagged photos follow the album's own photos, in the order the admin listed them. */
    persons: FeaturedPerson[];
    updatedAt: string;
}

export interface FeaturedPerson {
    id: string;
    fullName: string;
    nickname: string | null;
}

export type FeaturedAlbumInput = Omit<FeaturedAlbumConfig, 'updatedAt' | 'persons'> & { personIds: string[] };

interface FeaturedAlbumRow {
    enabled: number;
    folder_slug: string | null;
    photo_file_name: string | null;
    theme: FeaturedTheme;
    eyebrow: string;
    title: string;
    subtitle: string;
    message: string;
    button_label: string;
    updated_at: string;
}

export function getFeaturedAlbum(): FeaturedAlbumConfig {
    const row = getDb().prepare('SELECT * FROM featured_album WHERE id = 1').get() as FeaturedAlbumRow;
    return {
        enabled: row.enabled === 1,
        folderSlug: row.folder_slug,
        photoFileName: row.photo_file_name,
        theme: row.theme,
        eyebrow: row.eyebrow,
        title: row.title,
        subtitle: row.subtitle,
        message: row.message,
        buttonLabel: row.button_label,
        persons: getFeaturedPersons(),
        updatedAt: row.updated_at,
    };
}

function getFeaturedPersons(): FeaturedPerson[] {
    return getDb()
        .prepare(
            `SELECT p.id, p.full_name AS fullName, p.nickname
             FROM featured_album_persons f
             JOIN persons p ON p.id = f.person_id
             ORDER BY f.position`,
        )
        .all() as FeaturedPerson[];
}

/** Ids of the people whose tagged photos follow the featured album. */
export function getFeaturedPersonIds(): string[] {
    return getFeaturedPersons().map((p) => p.id);
}

export function updateFeaturedAlbum(input: FeaturedAlbumInput, userId: string): FeaturedAlbumConfig {
    const db = getDb();
    db.transaction(() => {
        db.prepare(
            `UPDATE featured_album
             SET enabled = ?, folder_slug = ?, photo_file_name = ?, theme = ?, eyebrow = ?, title = ?,
                 subtitle = ?, message = ?, button_label = ?, updated_at = datetime('now'), updated_by = ?
             WHERE id = 1`,
        ).run(
            input.enabled ? 1 : 0,
            input.folderSlug,
            input.photoFileName,
            input.theme,
            input.eyebrow,
            input.title,
            input.subtitle,
            input.message,
            input.buttonLabel,
            userId,
        );
        db.prepare('DELETE FROM featured_album_persons').run();
        const insert = db.prepare('INSERT INTO featured_album_persons (person_id, position) VALUES (?, ?)');
        input.personIds.forEach((id, i) => insert.run(id, i));
    })();
    return getFeaturedAlbum();
}
