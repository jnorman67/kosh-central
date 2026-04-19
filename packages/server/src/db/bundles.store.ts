import crypto from 'node:crypto';
import { getDb } from './database.js';

export type BundleSide = 'front' | 'back';

export interface StoredBundle {
    id: string;
    createdAt: string;
}

interface BundleRow {
    id: string;
    created_at: string;
    scanner_key: string | null;
}

function rowToBundle(row: BundleRow): StoredBundle {
    return { id: row.id, createdAt: row.created_at };
}

export function createBundle(scannerKey?: string): StoredBundle {
    const id = crypto.randomUUID();
    getDb()
        .prepare('INSERT INTO bundles (id, scanner_key) VALUES (?, ?)')
        .run(id, scannerKey ?? null);
    const row = getDb().prepare('SELECT * FROM bundles WHERE id = ?').get(id) as BundleRow;
    return rowToBundle(row);
}

export function findBundleById(id: string): StoredBundle | undefined {
    const row = getDb().prepare('SELECT * FROM bundles WHERE id = ?').get(id) as BundleRow | undefined;
    return row ? rowToBundle(row) : undefined;
}

/** Find-or-create a bundle keyed by the scanner's stable bundle key. */
export function upsertBundleByScannerKey(scannerKey: string): StoredBundle {
    const existing = getDb()
        .prepare('SELECT * FROM bundles WHERE scanner_key = ?')
        .get(scannerKey) as BundleRow | undefined;
    if (existing) return rowToBundle(existing);
    return createBundle(scannerKey);
}

/**
 * Assign a photo to a bundle on the given side, applying `preferredHint` only
 * when no photo is currently preferred for that (bundle, side). This preserves
 * admin-set preferences across re-scans.
 */
export function setBundleMembership(
    photoId: string,
    bundleId: string,
    side: BundleSide,
    preferredHint: boolean,
): void {
    const db = getDb();
    const tx = db.transaction(() => {
        db.prepare('UPDATE photos SET bundle_id = ?, side = ? WHERE id = ?').run(bundleId, side, photoId);
        if (preferredHint) {
            const existing = db
                .prepare(
                    'SELECT 1 FROM photos WHERE bundle_id = ? AND side = ? AND is_preferred = 1 AND id != ? LIMIT 1',
                )
                .get(bundleId, side, photoId);
            if (!existing) {
                db.prepare('UPDATE photos SET is_preferred = 1 WHERE id = ?').run(photoId);
            }
        }
    });
    tx();
}

/**
 * Mark the given photo as the preferred version for its (bundle, side),
 * unsetting any other preferred photo in the same group. Throws if the photo
 * has no bundle or side set.
 */
export function setPreferredPhoto(photoId: string): void {
    const db = getDb();
    const row = db
        .prepare('SELECT bundle_id, side FROM photos WHERE id = ?')
        .get(photoId) as { bundle_id: string | null; side: string | null } | undefined;
    if (!row) throw new Error(`Photo ${photoId} not found`);
    if (!row.bundle_id || !row.side) throw new Error(`Photo ${photoId} has no bundle membership`);

    const tx = db.transaction(() => {
        db.prepare('UPDATE photos SET is_preferred = 0 WHERE bundle_id = ? AND side = ?').run(
            row.bundle_id,
            row.side,
        );
        db.prepare('UPDATE photos SET is_preferred = 1 WHERE id = ?').run(photoId);
    });
    tx();
}
