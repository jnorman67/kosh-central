import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import { setPreferredPhoto } from '../db/bundles.store.js';
import { findPhotoById } from '../db/photos.store.js';
import type { ManifestSyncService } from '../services/manifest-sync.service.js';

export function createPhotosAdminRouter(manifestSyncService: ManifestSyncService): Router {
    const router = Router();
    router.use(requireAdmin);

    /**
     * Mark the given photo as the preferred version for its (bundle, side).
     * The previous preferred (if any) is cleared in the same transaction.
     */
    router.put('/:photoId/preferred', (req, res) => {
        const photo = findPhotoById(req.params.photoId);
        if (!photo) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }
        if (!photo.bundleId || !photo.side) {
            res.status(400).json({ error: 'Photo has no bundle membership' });
            return;
        }
        try {
            setPreferredPhoto(photo.id);
            res.json({ photoId: photo.id, bundleId: photo.bundleId, side: photo.side, isPreferred: true });
        } catch (err) {
            console.error('Set preferred photo error:', err);
            res.status(500).json({ error: 'Failed to set preferred photo' });
        }
    });

    /** Trigger an incremental sync of all kosh-manifest.json files from OneDrive. */
    router.post('/sync', async (_req, res) => {
        try {
            const result = await manifestSyncService.sync();
            res.json(result);
        } catch (err) {
            console.error('Manifest sync error:', err);
            res.status(500).json({ error: 'Manifest sync failed' });
        }
    });

    /** Trigger an incremental sync for a single folder. */
    router.post('/sync/:folderId', async (req, res) => {
        try {
            const result = await manifestSyncService.syncOne(req.params.folderId);
            res.json(result);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Manifest sync failed';
            const status = msg.startsWith('Folder not found') ? 404 : 500;
            console.error('Manifest sync error:', err);
            res.status(status).json({ error: msg });
        }
    });

    return router;
}
