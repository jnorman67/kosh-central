import { getDb } from './database.js';
import { FOLDER_SEED } from './folders.seed.js';

export interface StoredFolder {
    slug: string;
    displayName: string;
    sharingUrl: string;
    folderPath: string;
    sortOrder: number;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

export interface FolderInput {
    slug: string;
    displayName: string;
    sharingUrl: string;
    folderPath: string;
    sortOrder?: number;
    tags?: string[];
}

interface FolderRow {
    slug: string;
    display_name: string;
    sharing_url: string;
    folder_path: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

function rowToFolder(row: FolderRow, tags: string[]): StoredFolder {
    return {
        slug: row.slug,
        displayName: row.display_name,
        sharingUrl: row.sharing_url,
        folderPath: row.folder_path,
        sortOrder: row.sort_order,
        tags,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/** Replace the full tag set for a folder. Caller must ensure `tags` is a unique list. */
function writeTags(slug: string, tags: string[]): void {
    const db = getDb();
    db.prepare('DELETE FROM folder_tags WHERE folder_slug = ?').run(slug);
    if (tags.length === 0) return;
    const insert = db.prepare('INSERT INTO folder_tags (folder_slug, tag) VALUES (?, ?)');
    for (const tag of tags) insert.run(slug, tag);
}

// Module-level cache — the hot paths (GET /folders, GET /favorites) call
// listFolders() per request, and a single-container deployment means this
// cache stays coherent with the DB as long as mutations invalidate it.
let cache: StoredFolder[] | null = null;

function invalidate(): void {
    cache = null;
}

export function listFolders(): StoredFolder[] {
    if (cache) return cache;
    const db = getDb();
    const rows = db.prepare('SELECT * FROM folders ORDER BY sort_order, slug').all() as FolderRow[];
    const tagRows = db.prepare('SELECT folder_slug, tag FROM folder_tags').all() as {
        folder_slug: string;
        tag: string;
    }[];
    const tagsBySlug = new Map<string, string[]>();
    for (const { folder_slug, tag } of tagRows) {
        const arr = tagsBySlug.get(folder_slug);
        if (arr) arr.push(tag);
        else tagsBySlug.set(folder_slug, [tag]);
    }
    cache = rows.map((r) => rowToFolder(r, tagsBySlug.get(r.slug) ?? []));
    return cache;
}

export function findFolderBySlug(slug: string): StoredFolder | undefined {
    return listFolders().find((f) => f.slug === slug);
}

export function createFolder(input: FolderInput): StoredFolder {
    // Place new folders at the end unless the caller specifies a position.
    // Drag-and-drop reorders at 10-unit intervals, so +10 from the current max
    // leaves a new folder visually last without colliding.
    const db = getDb();
    const sortOrder =
        input.sortOrder && input.sortOrder > 0
            ? input.sortOrder
            : ((db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM folders').get() as { m: number }).m + 10);
    const txn = db.transaction(() => {
        db.prepare(
            `INSERT INTO folders (slug, display_name, sharing_url, folder_path, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
        ).run(input.slug, input.displayName, input.sharingUrl, input.folderPath, sortOrder);
        writeTags(input.slug, input.tags ?? []);
    });
    txn();
    invalidate();
    return findFolderBySlug(input.slug)!;
}

export function updateFolder(slug: string, input: FolderInput): StoredFolder | undefined {
    const db = getDb();
    let changed = 0;
    const txn = db.transaction(() => {
        const result = db
            .prepare(
                `UPDATE folders
                 SET slug = ?, display_name = ?, sharing_url = ?, folder_path = ?, sort_order = ?,
                     updated_at = datetime('now')
                 WHERE slug = ?`,
            )
            .run(input.slug, input.displayName, input.sharingUrl, input.folderPath, input.sortOrder ?? 0, slug);
        changed = result.changes;
        // ON UPDATE CASCADE has already moved any existing tag rows from `slug`
        // to `input.slug`, so overwrite under the new slug.
        if (changed > 0) writeTags(input.slug, input.tags ?? []);
    });
    txn();
    if (changed === 0) return undefined;
    invalidate();
    return findFolderBySlug(input.slug);
}

export function deleteFolder(slug: string): boolean {
    const result = getDb().prepare('DELETE FROM folders WHERE slug = ?').run(slug);
    if (result.changes === 0) return false;
    invalidate();
    return true;
}

export interface ImportResult {
    created: number;
    updated: number;
}

/** Upsert-by-slug: inserts new rows, updates existing ones. Does not delete. */
export function upsertFolders(folders: FolderInput[]): ImportResult {
    const db = getDb();
    const existingSlugs = new Set(
        (db.prepare('SELECT slug FROM folders').all() as { slug: string }[]).map((r) => r.slug),
    );

    const insert = db.prepare(
        `INSERT INTO folders (slug, display_name, sharing_url, folder_path, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
    );
    const update = db.prepare(
        `UPDATE folders
         SET display_name = ?, sharing_url = ?, folder_path = ?, sort_order = ?,
             updated_at = datetime('now')
         WHERE slug = ?`,
    );

    let created = 0;
    let updated = 0;
    const txn = db.transaction(() => {
        for (const f of folders) {
            if (existingSlugs.has(f.slug)) {
                update.run(f.displayName, f.sharingUrl, f.folderPath, f.sortOrder ?? 0, f.slug);
                updated++;
            } else {
                insert.run(f.slug, f.displayName, f.sharingUrl, f.folderPath, f.sortOrder ?? 0);
                created++;
            }
            writeTags(f.slug, f.tags ?? []);
        }
    });
    txn();
    invalidate();
    return { created, updated };
}

/**
 * Rewrite sort_order for every folder based on the given slug ordering.
 * Unknown slugs are ignored; existing folders not named in `slugs` keep
 * their current order relative to each other, placed after the named rows.
 * Assigns multiples of 10 so future inserts between rows are cheap.
 */
export function reorderFolders(slugs: string[]): void {
    const db = getDb();
    const update = db.prepare(
        "UPDATE folders SET sort_order = ?, updated_at = datetime('now') WHERE slug = ?",
    );
    const txn = db.transaction(() => {
        slugs.forEach((slug, i) => {
            update.run((i + 1) * 10, slug);
        });
    });
    txn();
    invalidate();
}

/** Full replace: wipes the table and inserts the payload. */
export function replaceAllFolders(folders: FolderInput[]): ImportResult {
    const db = getDb();
    const insert = db.prepare(
        `INSERT INTO folders (slug, display_name, sharing_url, folder_path, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
    );
    const txn = db.transaction(() => {
        // ON DELETE CASCADE wipes folder_tags alongside folders.
        db.prepare('DELETE FROM folders').run();
        for (const f of folders) {
            insert.run(f.slug, f.displayName, f.sharingUrl, f.folderPath, f.sortOrder ?? 0);
            writeTags(f.slug, f.tags ?? []);
        }
    });
    txn();
    invalidate();
    return { created: folders.length, updated: 0 };
}

/** Populates the table from FOLDER_SEED if it is currently empty. No-op otherwise. */
export function seedFoldersIfEmpty(): void {
    const db = getDb();
    const { n } = db.prepare('SELECT COUNT(*) as n FROM folders').get() as { n: number };
    if (n > 0) return;
    const insert = db.prepare(
        `INSERT INTO folders (slug, display_name, sharing_url, folder_path, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
    );
    const txn = db.transaction(() => {
        for (const f of FOLDER_SEED) {
            insert.run(f.slug, f.displayName, f.sharingUrl, f.folderPath, f.sortOrder);
        }
    });
    txn();
    invalidate();
    console.log(`Seeded folders table with ${FOLDER_SEED.length} entries`);
}
