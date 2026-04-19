import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import { setPreferredPhoto } from '../db/bundles.store.js';
import { findPhotoById } from '../db/photos.store.js';

export function createPhotosAdminRouter(): Router {
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

    return router;
}
