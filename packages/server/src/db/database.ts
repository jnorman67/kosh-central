import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';

const DB_FILENAME = 'kosh.db';

function getDbPath(): string {
    // Container Apps: DB lives on local container disk and is replicated to
    // blob storage by Litestream. Cannot live on the SMB-backed file share.
    if (process.env.KOSH_DB_PATH) {
        return process.env.KOSH_DB_PATH;
    }
    // Legacy: App Service persists /home across deploys
    if (process.env.NODE_ENV === 'production') {
        return path.join('/home', DB_FILENAME);
    }
    // Local dev — store next to other server data files
    const serverRoot = path.resolve(import.meta.dirname, '../..');
    return path.join(serverRoot, DB_FILENAME);
}

let db: Database.Database;

export function getDb(): Database.Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDb() first.');
    }
    return db;
}

export function initDb(): Database.Database {
    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    runMigrations(db);

    return db;
}

function runMigrations(db: Database.Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        )
    `);

    const currentVersion = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null };
    const version = currentVersion?.v ?? 0;

    const toRun = migrations.filter((m) => m.version > version);
    if (toRun.length === 0) return;

    const runAll = db.transaction(() => {
        for (const migration of toRun) {
            if (migration.sql) db.exec(migration.sql);
            if (migration.fn) migration.fn(db);
            db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
            console.log(`Migration ${migration.version}: ${migration.description}`);
        }
    });

    runAll();
}

interface Migration {
    version: number;
    description: string;
    sql?: string;
    fn?: (db: Database.Database) => void;
}

const migrations: Migration[] = [
    {
        version: 1,
        description: 'Create users table',
        sql: `
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                display_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `,
    },
    {
        version: 2,
        description: 'Create photos and photo_locations tables',
        sql: `
            CREATE TABLE photos (
                id TEXT PRIMARY KEY,
                content_hash TEXT NOT NULL UNIQUE,
                file_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                file_size INTEGER,
                taken_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE photo_locations (
                id TEXT PRIMARY KEY,
                photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
                folder_url TEXT,
                folder_name TEXT,
                onedrive_id TEXT,
                local_path TEXT,
                UNIQUE(photo_id, folder_url)
            );

            CREATE INDEX idx_photo_locations_photo_id ON photo_locations(photo_id);
        `,
    },
    {
        version: 3,
        description: 'Create photo_relations table',
        sql: `
            CREATE TABLE photo_relations (
                id TEXT PRIMARY KEY,
                photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
                related_photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
                relation_type TEXT NOT NULL CHECK (relation_type IN (
                    'back-of', 'front-of', 'duplicate-of',
                    'raw-version-of', 'enhanced-version-of'
                )),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                created_by TEXT REFERENCES users(id),
                UNIQUE(photo_id, related_photo_id, relation_type),
                CHECK(photo_id != related_photo_id)
            );

            CREATE INDEX idx_photo_relations_photo_id ON photo_relations(photo_id);
            CREATE INDEX idx_photo_relations_related_id ON photo_relations(related_photo_id);
        `,
    },
    {
        version: 4,
        description: 'Create photo_series and photo_series_members tables',
        sql: `
            CREATE TABLE photo_series (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                created_by TEXT REFERENCES users(id)
            );

            CREATE TABLE photo_series_members (
                series_id TEXT NOT NULL REFERENCES photo_series(id) ON DELETE CASCADE,
                photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
                position INTEGER NOT NULL DEFAULT 0,
                added_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY(series_id, photo_id)
            );

            CREATE INDEX idx_series_members_photo_id ON photo_series_members(photo_id);
        `,
    },
    {
        version: 5,
        description: 'Create folder_covers table',
        sql: `
            CREATE TABLE folder_covers (
                folder_path TEXT PRIMARY KEY,
                file_name TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_by TEXT REFERENCES users(id)
            );
        `,
    },
    {
        version: 6,
        description: 'Create photo_ratings table',
        sql: `
            CREATE TABLE photo_ratings (
                photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY(photo_id, user_id)
            );

            CREATE INDEX idx_photo_ratings_user_id ON photo_ratings(user_id);
        `,
    },
    {
        version: 7,
        description: 'Add provenance columns to photo_series for folder-derived series',
        sql: `
            ALTER TABLE photo_series ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual', 'folder'));
            ALTER TABLE photo_series ADD COLUMN source_key TEXT;
            CREATE UNIQUE INDEX idx_photo_series_source_key
                ON photo_series(source_key) WHERE source_key IS NOT NULL;
        `,
    },
    {
        version: 8,
        description: 'Create folders table for admin-editable folder configuration',
        sql: `
            CREATE TABLE folders (
                slug TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                sharing_url TEXT NOT NULL,
                folder_path TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE UNIQUE INDEX idx_folders_folder_path ON folders(folder_path COLLATE NOCASE);
        `,
    },
    {
        version: 9,
        description: 'Create bundles table and add bundle membership columns to photos',
        sql: `
            CREATE TABLE bundles (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            ALTER TABLE photos ADD COLUMN bundle_id TEXT REFERENCES bundles(id) ON DELETE SET NULL;
            ALTER TABLE photos ADD COLUMN side TEXT CHECK (side IN ('front', 'back'));
            ALTER TABLE photos ADD COLUMN is_preferred INTEGER NOT NULL DEFAULT 0 CHECK (is_preferred IN (0, 1));

            CREATE INDEX idx_photos_bundle ON photos(bundle_id);
            CREATE UNIQUE INDEX idx_photos_one_preferred_per_side
                ON photos(bundle_id, side) WHERE is_preferred = 1;
        `,
    },
    {
        version: 10,
        description: 'Backfill bundles from existing front/back and raw/enhanced relations',
        fn: backfillBundlesFromRelations,
    },
    {
        version: 11,
        description: 'Add scanner_key to bundles for idempotent manifest re-imports',
        sql: `
            ALTER TABLE bundles ADD COLUMN scanner_key TEXT;
            CREATE UNIQUE INDEX idx_bundles_scanner_key ON bundles(scanner_key) WHERE scanner_key IS NOT NULL;
        `,
    },
    {
        version: 12,
        description: 'Drop superseded bundle-level relations (keep duplicate-of)',
        sql: `
            DELETE FROM photo_relations
            WHERE relation_type IN ('back-of', 'front-of', 'raw-version-of', 'enhanced-version-of');
        `,
    },
];

/**
 * Build bundles from existing relation data. Connected components over the
 * bundle-related relation types become bundles; a photo is 'back' iff it is
 * the source of any back-of relation. Preferred is chosen heuristically
 * (enhanced variants of a front beat the bare name; alphabetical as fallback).
 *
 * After bundling, the bundle-level relation rows are deleted — bundles now
 * carry that information. `duplicate-of` rows are preserved for cross-bundle
 * duplicate tracking.
 */
function backfillBundlesFromRelations(db: Database.Database): void {
    const BUNDLE_RELATION_TYPES = ['back-of', 'front-of', 'raw-version-of', 'enhanced-version-of'];

    const photos = db.prepare('SELECT id, file_name FROM photos').all() as { id: string; file_name: string }[];
    if (photos.length === 0) return;

    const rels = db
        .prepare(
            `SELECT photo_id, related_photo_id, relation_type FROM photo_relations
             WHERE relation_type IN (${BUNDLE_RELATION_TYPES.map(() => '?').join(',')})`,
        )
        .all(...BUNDLE_RELATION_TYPES) as { photo_id: string; related_photo_id: string; relation_type: string }[];

    const parent = new Map<string, string>();
    for (const p of photos) parent.set(p.id, p.id);
    function find(x: string): string {
        let root = x;
        while (parent.get(root)! !== root) root = parent.get(root)!;
        while (parent.get(x)! !== root) {
            const next = parent.get(x)!;
            parent.set(x, root);
            x = next;
        }
        return root;
    }
    function union(a: string, b: string): void {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
    }
    for (const r of rels) union(r.photo_id, r.related_photo_id);

    // A photo is a back iff it is the source of a back-of relation (or,
    // equivalently by inverse pair, the target of a front-of relation).
    const backIds = new Set<string>();
    for (const r of rels) {
        if (r.relation_type === 'back-of') backIds.add(r.photo_id);
    }

    // Rank fronts: enhanced variants first, then bare, then anything else.
    function frontRank(fileName: string): number {
        const base = fileName.replace(/\.[^.]+$/, '');
        if (/[-_ ](a|alt|enhanced)$/i.test(base)) return 0;
        return 1;
    }

    const groups = new Map<string, string[]>();
    for (const p of photos) {
        const root = find(p.id);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root)!.push(p.id);
    }

    const photoById = new Map(photos.map((p) => [p.id, p]));
    const createBundle = db.prepare('INSERT INTO bundles (id) VALUES (?)');
    const updatePhoto = db.prepare('UPDATE photos SET bundle_id = ?, side = ?, is_preferred = ? WHERE id = ?');

    for (const [, groupIds] of groups) {
        const bundleId = crypto.randomUUID();
        createBundle.run(bundleId);

        const fronts: { id: string; file_name: string }[] = [];
        const backs: { id: string; file_name: string }[] = [];
        for (const id of groupIds) {
            const ph = photoById.get(id)!;
            if (backIds.has(id)) backs.push(ph);
            else fronts.push(ph);
        }

        fronts.sort(
            (a, b) => frontRank(a.file_name) - frontRank(b.file_name) || a.file_name.localeCompare(b.file_name),
        );
        backs.sort((a, b) => a.file_name.localeCompare(b.file_name));

        fronts.forEach((p, i) => updatePhoto.run(bundleId, 'front', i === 0 ? 1 : 0, p.id));
        backs.forEach((p, i) => updatePhoto.run(bundleId, 'back', i === 0 ? 1 : 0, p.id));
    }

    db.prepare(
        `DELETE FROM photo_relations WHERE relation_type IN (${BUNDLE_RELATION_TYPES.map(() => '?').join(',')})`,
    ).run(...BUNDLE_RELATION_TYPES);
}
