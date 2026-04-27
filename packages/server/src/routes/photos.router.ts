import { Router } from 'express';
import { listFolders } from '../db/folders.store.js';
import { findPhotoById, getPhotoLocations, getPhotoThumbnail, importManifest, listPhotos, type PhotoManifestEntry } from '../db/photos.store.js';
import { getRelationsForPhoto } from '../db/relations.store.js';
import { getSeriesForPhoto } from '../db/series.store.js';
import { createPhotoSubjectsRouter, createPhotoSubjectSuggestionsRouter } from './persons.router.js';

export function createPhotosRouter(): Router {
    const router = Router();

    router.use('/:photoId/subjects', createPhotoSubjectsRouter());
    router.use('/:photoId/subject-suggestions', createPhotoSubjectSuggestionsRouter());

    /** List all cataloged photos. */
    router.get('/', (_req, res) => {
        res.json(listPhotos());
    });

    /** Serve the stored thumbnail for a photo (JPEG). */
    router.get('/:photoId/thumbnail', (req, res) => {
        const photo = findPhotoById(req.params.photoId);
        if (!photo) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }
        const thumbnail = getPhotoThumbnail(req.params.photoId);
        if (!thumbnail) {
            res.status(404).json({ error: 'No thumbnail available' });
            return;
        }
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(thumbnail);
    });

    /** Get a single photo with its locations, relations, and series. */
    router.get('/:photoId', (req, res) => {
        const photo = findPhotoById(req.params.photoId);
        if (!photo) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }
        res.json({
            ...photo,
            locations: getPhotoLocations(photo.id),
            relations: getRelationsForPhoto(photo.id),
            series: getSeriesForPhoto(photo.id),
        });
    });

    /** Import a scan manifest (JSON body). */
    router.post('/import', (req, res) => {
        const body = req.body as { photos?: PhotoManifestEntry[] };
        if (!body.photos || !Array.isArray(body.photos)) {
            res.status(400).json({ error: 'Request body must have a "photos" array' });
            return;
        }
        const result = importManifest(
            body.photos,
            listFolders().map((f) => f.folderPath),
        );
        res.json(result);
    });

    return router;
}
