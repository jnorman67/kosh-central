import { Router } from 'express';
import { findFolderContainingPath, type StoredFolder } from '../db/folders.store.js';
import { getPhotoLocations } from '../db/photos.store.js';
import { getFavoritePhotosForUser } from '../db/ratings.store.js';
import { getRelationsForPhoto } from '../db/relations.store.js';
import { OneDriveService } from '../services/onedrive.service.js';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

function parseNonNegativeInt(raw: unknown, fallback: number, max?: number): number {
    if (typeof raw !== 'string') return fallback;
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 0) return fallback;
    if (max !== undefined && n > max) return max;
    return n;
}

export function createFavoritesRouter(oneDriveService: OneDriveService): Router {
    const router = Router();

    router.get('/', async (req, res) => {
        try {
            const offset = parseNonNegativeInt(req.query.offset, 0);
            const limit = parseNonNegativeInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT) || DEFAULT_LIMIT;

            const { rows, total } = getFavoritePhotosForUser(req.user!.userId, offset, limit);

            // Map each favorite to the configured folder it lives under, which handles photos in
            // subfolders of a configured album, not just at the album root.
            const assignments = rows.map((row) => {
                const locations = getPhotoLocations(row.photoId);
                for (const l of locations) {
                    if (!l.folderName) continue;
                    const folder = findFolderContainingPath(l.folderName);
                    if (folder) return { row, folder, locationFolderName: l.folderName };
                }
                return { row, folder: undefined, locationFolderName: undefined };
            });

            // Fetch OneDrive data for each unique folder in parallel (OneDriveService caches per URL).
            const uniqueFolders = Array.from(new Set(assignments.map((a) => a.folder).filter((f): f is StoredFolder => !!f)));
            const folderResults = await Promise.allSettled(uniqueFolders.map((f) => oneDriveService.getPhotos(f.sharingUrl)));
            // Key: lowercase `${folder.folderPath}/${subfolderPath}/${fileName}` (slashes collapsed
            // when subfolderPath is empty). One flat map across all fetched folders.
            const photoByFullPath = new Map<string, Awaited<ReturnType<OneDriveService['getPhotos']>>[number]>();
            uniqueFolders.forEach((folder, idx) => {
                const result = folderResults[idx];
                if (result.status !== 'fulfilled') return;
                for (const p of result.value) {
                    const dir = p.subfolderPath ? `${folder.folderPath}/${p.subfolderPath}` : folder.folderPath;
                    photoByFullPath.set(`${dir.toLowerCase()}/${p.name.toLowerCase()}`, p);
                }
            });

            const photos = assignments
                .map(({ row, folder, locationFolderName }) => {
                    if (!folder || !locationFolderName) return null;
                    const odPhoto = photoByFullPath.get(`${locationFolderName.toLowerCase()}/${row.fileName.toLowerCase()}`);
                    if (!odPhoto) return null;
                    return {
                        id: odPhoto.id,
                        name: odPhoto.name,
                        downloadUrl: odPhoto.downloadUrl,
                        thumbnailUrl: odPhoto.thumbnailUrl,
                        mimeType: odPhoto.mimeType,
                        catalogId: row.photoId,
                        contentHash: row.contentHash,
                        relations: getRelationsForPhoto(row.photoId),
                        rating: row.rating,
                        folderId: folder.slug,
                        folderDisplayName: folder.displayName,
                    };
                })
                .filter((p): p is NonNullable<typeof p> => !!p);

            res.json({ photos, total, offset, limit });
        } catch (err) {
            console.error('GET /favorites error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
}
