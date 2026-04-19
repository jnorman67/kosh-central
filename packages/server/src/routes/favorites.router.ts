import { Router } from 'express';
import { FOLDERS } from '../config/folders.config.js';
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
        const offset = parseNonNegativeInt(req.query.offset, 0);
        const limit = parseNonNegativeInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT) || DEFAULT_LIMIT;

        const { rows, total } = getFavoritePhotosForUser(req.user!.userId, offset, limit);

        // Map each favorite to the configured folder it lives in (first matching location wins).
        // Keys are lowercased because photo_locations.folder_name casing doesn't always match
        // folders.config.ts (the existing folder lookup uses SQL COLLATE NOCASE for the same reason).
        const folderByFolderPath = new Map(FOLDERS.map((f) => [f.folderPath.toLowerCase(), f]));
        const assignments = rows.map((row) => {
            const locations = getPhotoLocations(row.photoId);
            const match = locations
                .map((l) => (l.folderName ? folderByFolderPath.get(l.folderName.toLowerCase()) : undefined))
                .find((f): f is (typeof FOLDERS)[number] => !!f);
            return { row, folder: match };
        });

        // Fetch OneDrive data for each unique folder in parallel (OneDriveService caches per URL).
        const uniqueFolders = Array.from(new Set(assignments.map((a) => a.folder).filter((f): f is (typeof FOLDERS)[number] => !!f)));
        const folderResults = await Promise.allSettled(uniqueFolders.map((f) => oneDriveService.getPhotos(f.sharingUrl)));
        const byFolderPath = new Map<string, Map<string, Awaited<ReturnType<OneDriveService['getPhotos']>>[number]>>();
        uniqueFolders.forEach((folder, idx) => {
            const result = folderResults[idx];
            if (result.status !== 'fulfilled') return;
            const byName = new Map<string, (typeof result.value)[number]>();
            for (const p of result.value) byName.set(p.name.toLowerCase(), p);
            byFolderPath.set(folder.folderPath.toLowerCase(), byName);
        });

        const photos = assignments
            .map(({ row, folder }) => {
                if (!folder) return null;
                const odPhoto = byFolderPath.get(folder.folderPath.toLowerCase())?.get(row.fileName.toLowerCase());
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
                    folderId: String(FOLDERS.indexOf(folder)),
                    folderDisplayName: folder.displayName,
                };
            })
            .filter((p): p is NonNullable<typeof p> => !!p);

        res.json({ photos, total, offset, limit });
    });

    return router;
}
