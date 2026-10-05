#!/usr/bin/env npx tsx
/**
 * Inspect or apply the schema migrations defined in src/db/database.ts.
 *
 *   status  (default) list applied and pending migrations. Opens the database
 *           read-only, so it is safe against the prod snapshot.
 *   up      apply pending migrations — the same thing the server does on startup.
 *
 * The database is the server's default (KOSH_DB_PATH, else packages/server/kosh.db)
 * unless --db is given. Exits 1 from `status` when anything is pending, so it can
 * gate a script.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts [status|up] [--db path/to/kosh.db]
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getDbPath, getMigrationStatus, initDb } from '../src/db/database.js';

const args = process.argv.slice(2);
const dbFlag = args.indexOf('--db');
if (dbFlag !== -1) {
    if (!args[dbFlag + 1]) {
        console.error('--db needs a path');
        process.exit(1);
    }
    process.env.KOSH_DB_PATH = path.resolve(process.cwd(), args[dbFlag + 1]);
    args.splice(dbFlag, 2);
}
const command = args[0] ?? 'status';

const dbPath = getDbPath();
if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
}

if (command === 'status') {
    const db = new Database(dbPath, { readonly: true });
    const { applied, pending, unknown } = getMigrationStatus(db);
    db.close();

    console.log(`Database: ${dbPath}`);
    console.log(`Applied:  ${applied.length}${applied.length ? ` (latest ${applied[applied.length - 1].version})` : ''}`);
    for (const m of applied.slice(-5)) {
        console.log(`  ✓ ${String(m.version).padStart(3)}  ${m.description}${m.appliedAt ? `  [${m.appliedAt}]` : ''}`);
    }
    console.log(`Pending:  ${pending.length}`);
    for (const m of pending) {
        console.log(`  · ${String(m.version).padStart(3)}  ${m.description}`);
    }
    if (unknown.length) {
        console.log(`Unknown:  ${unknown.join(', ')} — recorded in the database but not defined in code`);
    }
    process.exit(pending.length ? 1 : 0);
} else if (command === 'up') {
    initDb();
    console.log(`Database ${dbPath} is up to date.`);
} else {
    console.error(`Unknown command "${command}". Usage: migrate.ts [status|up] [--db path]`);
    process.exit(1);
}
