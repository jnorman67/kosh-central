import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import type { SidecarImportService } from '../services/sidecar-import.service.js';

export function createSidecarsAdminRouter(sidecarImportService: SidecarImportService): Router {
    const router = Router();
    router.use(requireAdmin);

    /** Import sidecars across all configured folders. */
    router.post('/', async (_req, res) => {
        try {
            const result = await sidecarImportService.importAll();
            res.json(result);
        } catch (err) {
            console.error('Sidecar import error:', err);
            res.status(500).json({ error: 'Sidecar import failed' });
        }
    });

    /** Import sidecars for a single folder, by slug. */
    router.post('/:slug', async (req, res) => {
        try {
            const result = await sidecarImportService.importOne(req.params.slug);
            res.json(result);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Sidecar import failed';
            const status = msg.startsWith('Folder not found') ? 404 : 500;
            console.error('Sidecar import error:', err);
            res.status(status).json({ error: msg });
        }
    });

    return router;
}
