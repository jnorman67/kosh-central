import { Router } from 'express';
import { FOLDERS } from '../config/folders.config.js';
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
        try {
            const photos = await oneDriveService.getPhotos(FOLDERS[index].sharingUrl);
            res.json(photos);
        } catch (err) {
            console.error('OneDrive error:', err);
            res.status(502).json({ error: 'Failed to fetch photos from OneDrive' });
        }
    });

    return router;
}
