import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import { FOLDERS } from '../config/folders.config.js';
import { clearFolderCover, getAllFolderCovers, setFolderCover } from '../db/folder-covers.store.js';
import { findPhotoByFolderAndName } from '../db/photos.store.js';
import { getRatingsByUserForPhotos } from '../db/ratings.store.js';
import { getRelationsForPhoto } from '../db/relations.store.js';
import { OneDriveService } from '../services/onedrive.service.js';

function parseFolderIndex(raw: string | string[] | undefined): number | null {
    if (typeof raw !== 'string') return null;
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 0 || n >= FOLDERS.length) return null;
    return n;
}

export function createFoldersRouter(oneDriveService: OneDriveService): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        const covers = getAllFolderCovers();
        const result = FOLDERS.map((f, i) => ({
            id: String(i),
            displayName: f.displayName,
            coverFileName: covers.get(f.folderPath),
        }));
        res.json(result);
    });

    router.get('/:folderId/photos', async (req, res) => {
        const index = parseInt(req.params.folderId, 10);
        if (isNaN(index) || index < 0 || index >= FOLDERS.length) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        const folder = FOLDERS[index];
        try {
            const photos = await oneDriveService.getPhotos(folder.sharingUrl);

            // Enrich each OneDrive photo with local catalog data by matching
            // on (folderPath, fileName). See README "Local Catalog & Matching
            // Strategy" for why name-based matching is the current approach.
            const withCatalog = photos.map((p) => {
                const cataloged = findPhotoByFolderAndName(folder.folderPath, p.name);
                return { photo: p, cataloged };
            });

            const catalogedIds = withCatalog.map((x) => x.cataloged?.id).filter((id): id is string => !!id);
            const myRatings = getRatingsByUserForPhotos(req.user!.userId, catalogedIds);

            const enriched = withCatalog.map(({ photo, cataloged }) => {
                if (!cataloged) return { ...photo, relations: [] };
                return {
                    ...photo,
                    catalogId: cataloged.id,
                    contentHash: cataloged.contentHash,
                    relations: getRelationsForPhoto(cataloged.id),
                    rating: myRatings.get(cataloged.id) ?? null,
                };
            });

            res.json(enriched);
        } catch (err) {
            console.error('OneDrive error:', err);
            res.status(502).json({ error: 'Failed to fetch photos from OneDrive' });
        }
    });

    router.put('/:folderId/cover', requireAdmin, (req, res) => {
        const index = parseFolderIndex(req.params.folderId);
        if (index === null) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        const { fileName } = req.body as { fileName?: unknown };
        if (typeof fileName !== 'string' || fileName.length === 0) {
            res.status(400).json({ error: 'fileName is required' });
            return;
        }
        setFolderCover(FOLDERS[index].folderPath, fileName, req.user!.userId);
        res.json({ folderId: String(index), coverFileName: fileName });
    });

    router.delete('/:folderId/cover', requireAdmin, (req, res) => {
        const index = parseFolderIndex(req.params.folderId);
        if (index === null) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        clearFolderCover(FOLDERS[index].folderPath);
        res.json({ folderId: String(index), coverFileName: null });
    });

    return router;
}
