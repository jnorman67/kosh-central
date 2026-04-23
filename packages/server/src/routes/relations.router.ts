import { Router } from 'express';
import { findPhotoById } from '../db/photos.store.js';
import {
    createRelation,
    deleteRelation,
    findRelationById,
    getRelationsForPhoto,
    type RelationType,
} from '../db/relations.store.js';

const VALID_TYPES: RelationType[] = ['duplicate-of'];

export function createRelationsRouter(): Router {
    const router = Router();

    /** List relations for a photo. */
    router.get('/photo/:photoId', (req, res) => {
        const photo = findPhotoById(req.params.photoId);
        if (!photo) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }
        res.json(getRelationsForPhoto(photo.id));
    });

    /** Create a relation (and its inverse). */
    router.post('/', (req, res) => {
        const { photoId, relatedPhotoId, relationType } = req.body as {
            photoId?: string;
            relatedPhotoId?: string;
            relationType?: string;
        };

        if (!photoId || !relatedPhotoId || !relationType) {
            res.status(400).json({ error: 'photoId, relatedPhotoId, and relationType are required' });
            return;
        }
        if (!VALID_TYPES.includes(relationType as RelationType)) {
            res.status(400).json({ error: `relationType must be one of: ${VALID_TYPES.join(', ')}` });
            return;
        }
        if (photoId === relatedPhotoId) {
            res.status(400).json({ error: 'A photo cannot be related to itself' });
            return;
        }
        if (!findPhotoById(photoId)) {
            res.status(404).json({ error: `Photo ${photoId} not found` });
            return;
        }
        if (!findPhotoById(relatedPhotoId)) {
            res.status(404).json({ error: `Photo ${relatedPhotoId} not found` });
            return;
        }

        const userId = (req as unknown as { user?: { id: string } }).user?.id ?? null;

        try {
            const relation = createRelation(photoId, relatedPhotoId, relationType as RelationType, userId);
            res.status(201).json(relation);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('UNIQUE constraint')) {
                res.status(409).json({ error: 'This relation already exists' });
                return;
            }
            console.error('POST /relations error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    /** Delete a relation (and its inverse). */
    router.delete('/:relationId', (req, res) => {
        const relation = findRelationById(req.params.relationId);
        if (!relation) {
            res.status(404).json({ error: 'Relation not found' });
            return;
        }
        deleteRelation(req.params.relationId);
        res.status(204).end();
    });

    return router;
}
