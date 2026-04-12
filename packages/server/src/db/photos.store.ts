import crypto from 'node:crypto';
import { getDb } from './database.js';

export interface StoredPhoto {
    id: string;
    contentHash: string;
    fileName: string;
    mimeType: string;
    fileSize: number | null;
    takenAt: string | null;
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

export function createPhoto(photo: Omit<StoredPhoto, 'createdAt'>): StoredPhoto {
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
}

/** Bulk-import photos from a scan manifest. Returns counts of new vs existing. */
export function importManifest(entries: PhotoManifestEntry[]): { created: number; existing: number; locations: number } {
    const db = getDb();
    let created = 0;
    let existing = 0;
    let locations = 0;

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
        }
    });

    importAll();
    return { created, existing, locations };
}
