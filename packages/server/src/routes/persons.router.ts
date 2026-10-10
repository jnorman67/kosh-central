import { Router } from 'express';
import {
    addPhotoSubject,
    createPerson,
    findPersonById,
    findPersonByName,
    findPhotoSubject,
    getPhotosForPerson,
    getPeopleForPhotoEnriched,
    getPersonMentionSuggestionsForPhoto,
    getPersonsForSeries,
    getRelationshipsForPerson,
    getSeriesForPerson,
    listPersons,
    removePhotoSubject,
    searchPersons,
} from '../db/persons.store.js';
import { findPhotoById, getPhotoLocations } from '../db/photos.store.js';
import type { OneDriveService } from '../services/onedrive.service.js';
import type { ThumbnailCacheService } from '../services/thumbnail-cache.service.js';

export function createPersonsRouter(
    oneDriveService: OneDriveService,
    thumbnailCache: ThumbnailCacheService,
): Router {
    const router = Router();

    /** List all persons, or search by name/nickname with ?q= */
    router.get('/', (req, res) => {
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        res.json(q ? searchPersons(q) : listPersons());
    });

    /**
     * Suggest a person who isn't in the index yet. They can be tagged right away and show as
     * pending until an admin approves, merges, or rejects them. An exact name match returns
     * the existing person instead of creating a duplicate.
     */
    router.post('/proposals', (req, res) => {
        const { fullName, nickname, notes } = req.body as { fullName?: string; nickname?: string; notes?: string };
        const name = fullName?.trim();
        if (!name) {
            res.status(400).json({ error: 'fullName is required' });
            return;
        }
        const existing = findPersonByName(name);
        if (existing) {
            res.json(existing);
            return;
        }
        const person = createPerson(name, {
            nickname: nickname?.trim() || undefined,
            notes: notes?.trim() || undefined,
            proposed: true,
            createdBy: req.user!.userId,
        });
        res.status(201).json(person);
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

    /** Proxy for a person's portrait thumbnail. Cached on disk keyed by OneDrive item id. */
    router.get('/:id/portrait-thumb', async (req, res) => {
        const person = findPersonById(req.params.id);
        if (!person?.portraitPhotoId) {
            res.status(404).json({ error: 'No portrait set' });
            return;
        }

        const locations = getPhotoLocations(person.portraitPhotoId);
        const loc = locations.find((l) => l.onedriveId && l.folderUrl);
        if (!loc?.onedriveId || !loc.folderUrl) {
            res.status(404).json({ error: 'Portrait photo has no OneDrive location' });
            return;
        }

        const cached = thumbnailCache.read(loc.onedriveId);
        if (cached) {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
            res.send(cached);
            return;
        }

        try {
            const photos = await oneDriveService.getPhotos(loc.folderUrl);
            const photo = photos.find((p) => p.id === loc.onedriveId);
            if (!photo?.thumbnailUrl) {
                res.status(404).json({ error: 'Portrait thumbnail not available' });
                return;
            }
            const upstream = await fetch(photo.thumbnailUrl);
            if (!upstream.ok) {
                res.status(502).json({ error: `Upstream thumbnail fetch failed: ${upstream.status}` });
                return;
            }
            const buf = Buffer.from(await upstream.arrayBuffer());
            thumbnailCache.write(loc.onedriveId, buf);
            res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');
            res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
            res.send(buf);
        } catch (err) {
            console.error('Portrait thumbnail proxy error:', err);
            res.status(502).json({ error: 'Failed to fetch portrait thumbnail' });
        }
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

/** Sub-router for photo subjects (people tagged in a photo), mounted on the photos router at /:photoId/subjects */
export function createPhotoSubjectsRouter(): Router {
    const router = Router({ mergeParams: true });

    router.get('/', (req, res) => {
        const { photoId } = req.params as Record<string, string>;
        res.json(getPeopleForPhotoEnriched(photoId));
    });

    /** Tag a person in a photo. Open to every signed-in user. */
    router.post('/', (req, res) => {
        const { photoId } = req.params as Record<string, string>;
        const { personId } = req.body as { personId?: string };
        if (!personId) {
            res.status(400).json({ error: 'personId is required' });
            return;
        }
        if (!findPersonById(personId)) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        if (!findPhotoById(photoId)) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }
        try {
            const subject = addPhotoSubject(photoId, personId, { createdBy: req.user!.userId });
            res.status(201).json(subject);
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes('UNIQUE')) {
                res.status(409).json({ error: 'Person already tagged in this photo' });
            } else {
                res.status(500).json({ error: 'Failed to tag person in photo' });
            }
        }
    });

    /** Remove a person tag. Admins can remove any tag; other users only the tags they added. */
    router.delete('/:personId', (req, res) => {
        const { photoId, personId } = req.params as Record<string, string>;
        const subject = findPhotoSubject(photoId, personId);
        if (!subject) {
            res.status(404).json({ error: 'Tag not found' });
            return;
        }
        if (req.user!.role !== 'admin' && subject.createdBy !== req.user!.userId) {
            res.status(403).json({ error: 'Only an admin or the person who added this tag can remove it' });
            return;
        }
        removePhotoSubject(photoId, personId);
        res.status(204).end();
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
