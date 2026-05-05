import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import type { ManifestSyncService } from '../services/manifest-sync.service.js';

export function createPhotosAdminRouter(manifestSyncService: ManifestSyncService): Router {
    const router = Router();
    router.use(requireAdmin);

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
