import Database from 'better-sqlite3';
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
            db.exec(migration.sql);
            db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
            console.log(`Migration ${migration.version}: ${migration.description}`);
        }
    });

    runAll();
}

interface Migration {
    version: number;
    description: string;
    sql: string;
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
];
