import Database from 'better-sqlite3';
import path from 'node:path';

const DB_FILENAME = 'kosh.db';

function getDbPath(): string {
    if (process.env.NODE_ENV === 'production') {
        // Azure App Service persists /home across deploys
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
];
