import { Router } from 'express';
import {
    findPersonById,
    getPhotosForPerson,
    getPeopleForPhotoEnriched,
    getPersonMentionSuggestionsForPhoto,
    getPersonsForSeries,
    getRelationshipsForPerson,
    getSeriesForPerson,
    listPersons,
    searchPersons,
} from '../db/persons.store.js';

export function createPersonsRouter(): Router {
    const router = Router();

    /** List all persons, or search by name/nickname with ?q= */
    router.get('/', (req, res) => {
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        res.json(q ? searchPersons(q) : listPersons());
    });

    /** Get a single person. */
    router.get('/:id', (req, res) => {
        const person = findPersonById(req.params.id);
        if (!person) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        res.json(person);
    });

    /** Get all relationships for a person. */
    router.get('/:id/relationships', (req, res) => {
        if (!findPersonById(req.params.id)) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        res.json(getRelationshipsForPerson(req.params.id));
    });

    /** Get all photos featuring a person. */
    router.get('/:id/photo-tags', (req, res) => {
        if (!findPersonById(req.params.id)) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        res.json(getPhotosForPerson(req.params.id));
    });

    /** Get all series featuring a person. */
    router.get('/:id/series-tags', (req, res) => {
        if (!findPersonById(req.params.id)) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        res.json(getSeriesForPerson(req.params.id));
    });

    return router;
}

/** Sub-router for photo subject reads, mounted on the photos router at /:photoId/subjects */
export function createPhotoSubjectsRouter(): Router {
    const router = Router({ mergeParams: true });

    router.get('/', (req, res) => {
        const { photoId } = req.params as Record<string, string>;
        res.json(getPeopleForPhotoEnriched(photoId));
    });

    return router;
}

/** Sub-router for photo subject suggestions (comment-derived), mounted at /:photoId/subject-suggestions */
export function createPhotoSubjectSuggestionsRouter(): Router {
    const router = Router({ mergeParams: true });

    router.get('/', (req, res) => {
        const { photoId } = req.params as Record<string, string>;
        res.json(getPersonMentionSuggestionsForPhoto(photoId));
    });

    return router;
}

/** Sub-router for series subject reads, mounted on the series router at /:seriesId/subjects */
export function createSeriesSubjectsRouter(): Router {
    const router = Router({ mergeParams: true });

    router.get('/', (req, res) => {
        const { seriesId } = req.params as Record<string, string>;
        res.json(getPersonsForSeries(seriesId));
    });

    return router;
}
