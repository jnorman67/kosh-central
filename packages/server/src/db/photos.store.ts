import crypto from 'node:crypto';
import { setBundleMembership, upsertBundleByScannerKey, type BundleSide } from './bundles.store.js';
import { getDb } from './database.js';
import { addSeriesMember, upsertFolderSeries } from './series.store.js';

export interface StoredPhoto {
    id: string;
    contentHash: string;
    fileName: string;
    mimeType: string;
    fileSize: number | null;
    takenAt: string | null;
    bundleId: string | null;
    side: BundleSide | null;
    isPreferred: boolean;
    createdAt: string;
}

export interface StoredPhotoLocation {
    id: string;
    photoId: string;
    folderUrl: string | null;
    folderName: string | null;
    onedriveId: string | null;
    localPath: string | null;
}

interface PhotoRow {
    id: string;
    content_hash: string;
    file_name: string;
    mime_type: string;
    file_size: number | null;
    taken_at: string | null;
    bundle_id: string | null;
    side: string | null;
    is_preferred: number;
    created_at: string;
}

interface LocationRow {
    id: string;
    photo_id: string;
    folder_url: string | null;
    folder_name: string | null;
    onedrive_id: string | null;
    local_path: string | null;
}

function rowToPhoto(row: PhotoRow): StoredPhoto {
    return {
        id: row.id,
        contentHash: row.content_hash,
        fileName: row.file_name,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        takenAt: row.taken_at,
        bundleId: row.bundle_id,
        side: (row.side as BundleSide | null) ?? null,
        isPreferred: row.is_preferred === 1,
        createdAt: row.created_at,
    };
}

function rowToLocation(row: LocationRow): StoredPhotoLocation {
    return {
        id: row.id,
        photoId: row.photo_id,
        folderUrl: row.folder_url,
        folderName: row.folder_name,
        onedriveId: row.onedrive_id,
        localPath: row.local_path,
    };
}

export function findPhotoByHash(contentHash: string): StoredPhoto | undefined {
    const row = getDb()
        .prepare('SELECT * FROM photos WHERE content_hash = ?')
        .get(contentHash) as PhotoRow | undefined;
    return row ? rowToPhoto(row) : undefined;
}

export function findPhotoById(id: string): StoredPhoto | undefined {
    const row = getDb().prepare('SELECT * FROM photos WHERE id = ?').get(id) as PhotoRow | undefined;
    return row ? rowToPhoto(row) : undefined;
}

export function listPhotos(): StoredPhoto[] {
    const rows = getDb().prepare('SELECT * FROM photos ORDER BY file_name').all() as PhotoRow[];
    return rows.map(rowToPhoto);
}

export function createPhoto(photo: Omit<StoredPhoto, 'createdAt' | 'bundleId' | 'side' | 'isPreferred'>): StoredPhoto {
    const db = getDb();
    db.prepare(
        'INSERT INTO photos (id, content_hash, file_name, mime_type, file_size, taken_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(photo.id, photo.contentHash, photo.fileName, photo.mimeType, photo.fileSize, photo.takenAt);

    return findPhotoById(photo.id)!;
}

export function getPhotoLocations(photoId: string): StoredPhotoLocation[] {
    const rows = getDb()
        .prepare('SELECT * FROM photo_locations WHERE photo_id = ?')
        .all(photoId) as LocationRow[];
    return rows.map(rowToLocation);
}

/**
 * Look up a cataloged photo by its (folderName, fileName) location pair.
 * Used to join OneDrive listings with the local catalog. Matching is
 * case-insensitive so minor casing differences between the configured
 * folder path and the scanned path don't break the join.
 */
export function findPhotoByFolderAndName(folderName: string, fileName: string): StoredPhoto | undefined {
    const row = getDb()
        .prepare(
            `SELECT p.* FROM photos p
             JOIN photo_locations l ON l.photo_id = p.id
             WHERE l.folder_name = ? COLLATE NOCASE
               AND p.file_name = ? COLLATE NOCASE
             LIMIT 1`,
        )
        .get(folderName, fileName) as PhotoRow | undefined;
    return row ? rowToPhoto(row) : undefined;
}

/**
 * Return the other photos (by id) that share the bundle of the given photo.
 * Used to surface bundle siblings via the folder photos endpoint so the client
 * can render related-photo thumbnails without a second round trip.
 */
export function getBundleSiblingIds(bundleId: string, excludePhotoId: string): string[] {
    const rows = getDb()
        .prepare('SELECT id FROM photos WHERE bundle_id = ? AND id != ?')
        .all(bundleId, excludePhotoId) as { id: string }[];
    return rows.map((r) => r.id);
}

export function addPhotoLocation(location: Omit<StoredPhotoLocation, 'id'>): StoredPhotoLocation {
    const id = crypto.randomUUID();
    getDb()
        .prepare(
            'INSERT OR IGNORE INTO photo_locations (id, photo_id, folder_url, folder_name, onedrive_id, local_path) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(id, location.photoId, location.folderUrl, location.folderName, location.onedriveId, location.localPath);
    return { id, ...location };
}

export interface PhotoManifestEntry {
    contentHash: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    takenAt?: string;
    folderName: string;
    folderUrl?: string;
    localPath?: string;
    onedriveId?: string;
    /** Bundle grouping fields emitted by the scanner. When absent, the photo is imported without bundle membership. */
    bundleKey?: string;
    side?: BundleSide;
    preferredHint?: boolean;
}

/**
 * If `entry.folderName` lies under one of the configured `folderRoots`, return
 * the leaf segment of the relative subfolder path (used as a series name).
 * Returns null when the photo sits directly in a configured root or in no
 * configured root at all.
 */
function deriveSubfolderLeaf(folderName: string, folderRoots: string[]): string | null {
    const lower = folderName.toLowerCase();
    const match = folderRoots.find(
        (r) => lower === r.toLowerCase() || lower.startsWith(r.toLowerCase() + '/'),
    );
    if (!match) return null;
    const suffix = folderName.slice(match.length).replace(/^\//, '');
    if (!suffix) return null;
    return suffix.split('/').pop() ?? null;
}

/** Bulk-import photos from a scan manifest. Returns counts. */
export function importManifest(
    entries: PhotoManifestEntry[],
    folderRoots?: string[],
): {
    created: number;
    existing: number;
    locations: number;
    bundles: number;
    seriesMembers: number;
} {
    const db = getDb();
    let created = 0;
    let existing = 0;
    let locations = 0;
    let seriesMembers = 0;

    // Resolve each unique scanner bundleKey to a bundle id (find-or-create), memoized per import.
    const bundleIdByKey = new Map<string, string>();

    const importAll = db.transaction(() => {
        for (const entry of entries) {
            let photo = findPhotoByHash(entry.contentHash);

            if (photo) {
                existing++;
            } else {
                photo = createPhoto({
                    id: crypto.randomUUID(),
                    contentHash: entry.contentHash,
                    fileName: entry.fileName,
                    mimeType: entry.mimeType,
                    fileSize: entry.fileSize,
                    takenAt: entry.takenAt ?? null,
                });
                created++;
            }

            addPhotoLocation({
                photoId: photo.id,
                folderUrl: entry.folderUrl ?? null,
                folderName: entry.folderName,
                onedriveId: entry.onedriveId ?? null,
                localPath: entry.localPath ?? null,
            });
            locations++;

            if (entry.bundleKey && entry.side) {
                let bundleId = bundleIdByKey.get(entry.bundleKey);
                if (!bundleId) {
                    bundleId = upsertBundleByScannerKey(entry.bundleKey).id;
                    bundleIdByKey.set(entry.bundleKey, bundleId);
                }
                setBundleMembership(photo.id, bundleId, entry.side, !!entry.preferredHint);
            }

            if (folderRoots) {
                const leaf = deriveSubfolderLeaf(entry.folderName, folderRoots);
                if (leaf) {
                    const series = upsertFolderSeries(entry.folderName, leaf);
                    addSeriesMember(series.id, photo.id, 0);
                    seriesMembers++;
                }
            }
        }
    });

    importAll();
    return { created, existing, locations, bundles: bundleIdByKey.size, seriesMembers };
}
