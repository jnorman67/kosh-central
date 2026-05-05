import crypto from 'node:crypto';
import { getDb } from './database.js';

export interface StoredOcrResult {
    id: string;
    bundleId: string;
    text: string;
    ranAt: string;
}

interface OcrRow {
    id: string;
    bundle_id: string;
    text: string;
    ran_at: string;
}

function rowToOcr(row: OcrRow): StoredOcrResult {
    return { id: row.id, bundleId: row.bundle_id, text: row.text, ranAt: row.ran_at };
}

export function findOcrByBundleId(bundleId: string): StoredOcrResult | undefined {
    const row = getDb()
        .prepare('SELECT * FROM ocr_results WHERE bundle_id = ?')
        .get(bundleId) as OcrRow | undefined;
    return row ? rowToOcr(row) : undefined;
}

export function upsertOcr(bundleId: string, text: string): StoredOcrResult {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM ocr_results WHERE bundle_id = ?').get(bundleId) as { id: string } | undefined;
    const id = existing?.id ?? crypto.randomUUID();
    db.prepare(
        `INSERT INTO ocr_results (id, bundle_id, text, ran_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(bundle_id) DO UPDATE SET text = excluded.text, ran_at = excluded.ran_at`,
    ).run(id, bundleId, text);
    return rowToOcr(db.prepare('SELECT * FROM ocr_results WHERE id = ?').get(id) as OcrRow);
}
