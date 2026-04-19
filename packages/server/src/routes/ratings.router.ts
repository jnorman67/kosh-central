import { Router } from 'express';
import { findPhotoById } from '../db/photos.store.js';
import { deleteRating, setRating } from '../db/ratings.store.js';

export function createRatingsRouter(): Router {
    const router = Router();

    /** Upsert the current user's rating for a photo (0–5). */
    router.put('/photo/:photoId', (req, res) => {
        const photo = findPhotoById(req.params.photoId);
        if (!photo) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }

        const { rating } = req.body as { rating?: unknown };
        if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 0 || rating > 5) {
            res.status(400).json({ error: 'rating must be an integer between 0 and 5' });
            return;
        }

        const userId = req.user!.userId;
        const stored = setRating(photo.id, userId, rating);
        res.json(stored);
    });

    /** Clear the current user's rating for a photo. */
    router.delete('/photo/:photoId', (req, res) => {
        const photo = findPhotoById(req.params.photoId);
        if (!photo) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }
        deleteRating(photo.id, req.user!.userId);
        res.status(204).end();
    });

    return router;
}
