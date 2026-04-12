import { Router } from 'express';
import { findPhotoById } from '../db/photos.store.js';
import {
    addSeriesMember,
    createSeries,
    deleteSeries,
    findSeriesById,
    getSeriesMembers,
    listSeries,
    removeSeriesMember,
    updateSeries,
} from '../db/series.store.js';

export function createSeriesRouter(): Router {
    const router = Router();

    /** List all series. */
    router.get('/', (_req, res) => {
        res.json(listSeries());
    });

    /** Get a series with its members. */
    router.get('/:seriesId', (req, res) => {
        const series = findSeriesById(req.params.seriesId);
        if (!series) {
            res.status(404).json({ error: 'Series not found' });
            return;
        }
        res.json({ ...series, members: getSeriesMembers(series.id) });
    });

    /** Create a series. */
    router.post('/', (req, res) => {
        const { name, description } = req.body as { name?: string; description?: string };
        if (!name) {
            res.status(400).json({ error: 'name is required' });
            return;
        }
        const userId = (req as unknown as { user?: { id: string } }).user?.id ?? null;
        const series = createSeries(name, description ?? null, userId);
        res.status(201).json(series);
    });

    /** Update a series. */
    router.put('/:seriesId', (req, res) => {
        const { name, description } = req.body as { name?: string; description?: string };
        if (!name) {
            res.status(400).json({ error: 'name is required' });
            return;
        }
        const series = updateSeries(req.params.seriesId, name, description ?? null);
        if (!series) {
            res.status(404).json({ error: 'Series not found' });
            return;
        }
        res.json(series);
    });

    /** Delete a series. */
    router.delete('/:seriesId', (req, res) => {
        if (!deleteSeries(req.params.seriesId)) {
            res.status(404).json({ error: 'Series not found' });
            return;
        }
        res.status(204).end();
    });

    /** Add a photo to a series. */
    router.post('/:seriesId/members', (req, res) => {
        const { photoId, position } = req.body as { photoId?: string; position?: number };
        if (!photoId) {
            res.status(400).json({ error: 'photoId is required' });
            return;
        }
        if (!findSeriesById(req.params.seriesId)) {
            res.status(404).json({ error: 'Series not found' });
            return;
        }
        if (!findPhotoById(photoId)) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }
        const member = addSeriesMember(req.params.seriesId, photoId, position ?? 0);
        res.status(201).json(member);
    });

    /** Remove a photo from a series. */
    router.delete('/:seriesId/members/:photoId', (req, res) => {
        if (!removeSeriesMember(req.params.seriesId, req.params.photoId)) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }
        res.status(204).end();
    });

    return router;
}
