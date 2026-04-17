import { Router } from 'express';
import { FOLDERS } from '../config/folders.config.js';
import { findPhotoByFolderAndName } from '../db/photos.store.js';
import { getRelationsForPhoto } from '../db/relations.store.js';
import { OneDriveService } from '../services/onedrive.service.js';

export function createFoldersRouter(oneDriveService: OneDriveService): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        const result = FOLDERS.map((f, i) => ({ id: String(i), displayName: f.displayName }));
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
            const enriched = photos.map((p) => {
                const cataloged = findPhotoByFolderAndName(folder.folderPath, p.name);
                if (!cataloged) return { ...p, relations: [] };
                return {
                    ...p,
                    catalogId: cataloged.id,
                    contentHash: cataloged.contentHash,
                    relations: getRelationsForPhoto(cataloged.id),
                };
            });

            res.json(enriched);
        } catch (err) {
            console.error('OneDrive error:', err);
            res.status(502).json({ error: 'Failed to fetch photos from OneDrive' });
        }
    });

    return router;
}
