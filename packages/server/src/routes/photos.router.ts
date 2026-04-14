import { Router } from 'express';
import {
    findPhotoById,
    getPhotoLocations,
    importManifest,
    listPhotos,
    type ManifestRelationEntry,
    type PhotoManifestEntry,
} from '../db/photos.store.js';
import { getRelationsForPhoto } from '../db/relations.store.js';
import { getSeriesForPhoto } from '../db/series.store.js';

export function createPhotosRouter(): Router {
    const router = Router();

    /** List all cataloged photos. */
    router.get('/', (_req, res) => {
        res.json(listPhotos());
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
        const body = req.body as { photos?: PhotoManifestEntry[]; relations?: ManifestRelationEntry[] };
        if (!body.photos || !Array.isArray(body.photos)) {
            res.status(400).json({ error: 'Request body must have a "photos" array' });
            return;
        }
        const result = importManifest(body.photos, body.relations);
        res.json(result);
    });

    return router;
}
