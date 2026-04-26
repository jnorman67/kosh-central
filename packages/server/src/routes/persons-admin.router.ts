import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import {
    addPhotoSubject,
    addRelationship,
    addSeriesSubject,
    confirmPersonImport,
    createPerson,
    deletePerson,
    deleteRelationship,
    findPersonById,
    findRelationshipById,
    listPersonsNeedingReview,
    removePhotoSubject,
    removeSeriesSubject,
    updatePerson,
    verifyPhotoSubject,
    type RelationshipType,
    type SubjectSource,
} from '../db/persons.store.js';
import { findPhotoById } from '../db/photos.store.js';
import { findSeriesById } from '../db/series.store.js';

const VALID_RELATION_TYPES = new Set<string>(['parent-of', 'spouse-of', 'sibling-of', 'friend-of']);
const VALID_SUBJECT_SOURCES = new Set<string>(['manual', 'auto']);

export function createPersonsAdminRouter(): Router {
    const router = Router();
    router.use(requireAdmin);

    // ── Persons CRUD ──────────────────────────────────────────────────────────

    /** Create a person. */
    router.post('/', (req, res) => {
        const { fullName, nickname, birthYear, notes, sex, birthDate, deathDate, birthPlace, deathPlace } =
            req.body as {
                fullName?: string;
                nickname?: string;
                birthYear?: number;
                notes?: string;
                sex?: 'M' | 'F' | 'U';
                birthDate?: string;
                deathDate?: string;
                birthPlace?: string;
                deathPlace?: string;
            };
        if (!fullName) {
            res.status(400).json({ error: 'fullName is required' });
            return;
        }
        const userId = (req as unknown as { user?: { id: string } }).user?.id;
        const person = createPerson(fullName, {
            nickname,
            birthYear,
            notes,
            sex,
            birthDate,
            deathDate,
            birthPlace,
            deathPlace,
            createdBy: userId,
        });
        res.status(201).json(person);
    });

    /** Update a person. */
    router.patch('/:id', (req, res) => {
        if (!findPersonById(req.params.id)) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        const { fullName, nickname, birthYear, notes, sex, birthDate, deathDate, birthPlace, deathPlace } =
            req.body as {
                fullName?: string;
                nickname?: string | null;
                birthYear?: number | null;
                notes?: string | null;
                sex?: 'M' | 'F' | 'U' | null;
                birthDate?: string | null;
                deathDate?: string | null;
                birthPlace?: string | null;
                deathPlace?: string | null;
            };
        try {
            const person = updatePerson(req.params.id, {
                fullName,
                nickname,
                birthYear,
                notes,
                sex,
                birthDate,
                deathDate,
                birthPlace,
                deathPlace,
            });
            res.json(person);
        } catch {
            res.status(500).json({ error: 'Failed to update person' });
        }
    });

    /** Delete a person. Refused if the person has photo or series tags. */
    router.delete('/:id', (req, res) => {
        if (!findPersonById(req.params.id)) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        const result = deletePerson(req.params.id);
        if (!result.deleted) {
            res.status(409).json({
                error: result.reason === 'has_photo_tags'
                    ? 'Cannot delete: person is tagged in one or more photos'
                    : 'Cannot delete: person is tagged in one or more series',
            });
            return;
        }
        res.status(204).end();
    });

    // ── GEDCOM import review ───────────────────────────────────────────────────

    /** List persons flagged needs_review after a GEDCOM reconciliation import. */
    router.get('/import/needs-review', (req, res) => {
        res.json(listPersonsNeedingReview());
    });

    /** Confirm a needs_review match (sets import_status to confirmed). */
    router.post('/:id/confirm-import', (req, res) => {
        if (!findPersonById(req.params.id)) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        confirmPersonImport(req.params.id);
        res.status(204).end();
    });

    // ── Relationships ─────────────────────────────────────────────────────────

    /** Add a relationship from this person to another. */
    router.post('/:id/relationships', (req, res) => {
        const { toPersonId, relationType } = req.body as { toPersonId?: string; relationType?: string };
        if (!toPersonId || !relationType) {
            res.status(400).json({ error: 'toPersonId and relationType are required' });
            return;
        }
        if (!VALID_RELATION_TYPES.has(relationType)) {
            res.status(400).json({ error: `relationType must be one of: ${[...VALID_RELATION_TYPES].join(', ')}` });
            return;
        }
        if (!findPersonById(req.params.id)) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        if (!findPersonById(toPersonId)) {
            res.status(404).json({ error: 'Target person not found' });
            return;
        }
        const userId = (req as unknown as { user?: { id: string } }).user?.id;
        try {
            const rel = addRelationship(req.params.id, toPersonId, relationType as RelationshipType, userId);
            res.status(201).json(rel);
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes('UNIQUE')) {
                res.status(409).json({ error: 'Relationship already exists' });
            } else {
                res.status(500).json({ error: 'Failed to add relationship' });
            }
        }
    });

    /** Delete a relationship (and its inverse for symmetric types). */
    router.delete('/relationships/:relId', (req, res) => {
        const rel = findRelationshipById(req.params.relId);
        if (!rel) {
            res.status(404).json({ error: 'Relationship not found' });
            return;
        }
        deleteRelationship(req.params.relId);
        res.status(204).end();
    });

    // ── Photo tags ────────────────────────────────────────────────────────────

    /** Tag a person in a photo. */
    router.post('/:id/photo-tags', (req, res) => {
        const { photoId, source, confidence, faceRegion } = req.body as {
            photoId?: string;
            source?: string;
            confidence?: number;
            faceRegion?: string;
        };
        if (!photoId) {
            res.status(400).json({ error: 'photoId is required' });
            return;
        }
        if (source && !VALID_SUBJECT_SOURCES.has(source)) {
            res.status(400).json({ error: 'source must be manual or auto' });
            return;
        }
        if (!findPersonById(req.params.id)) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        if (!findPhotoById(photoId)) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }
        const userId = (req as unknown as { user?: { id: string } }).user?.id;
        try {
            const subject = addPhotoSubject(photoId, req.params.id, {
                source: source as SubjectSource | undefined,
                confidence,
                faceRegion,
                createdBy: userId,
            });
            res.status(201).json(subject);
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes('UNIQUE')) {
                res.status(409).json({ error: 'Person already tagged in this photo' });
            } else {
                res.status(500).json({ error: 'Failed to tag person in photo' });
            }
        }
    });

    /** Remove a person tag from a photo. */
    router.delete('/:id/photo-tags/:photoId', (req, res) => {
        if (!removePhotoSubject(req.params.photoId, req.params.id)) {
            res.status(404).json({ error: 'Tag not found' });
            return;
        }
        res.status(204).end();
    });

    /** Mark an auto-assigned photo tag as verified. */
    router.post('/:id/photo-tags/:photoId/verify', (req, res) => {
        if (!verifyPhotoSubject(req.params.photoId, req.params.id)) {
            res.status(404).json({ error: 'Tag not found' });
            return;
        }
        res.status(204).end();
    });

    // ── Series tags ───────────────────────────────────────────────────────────

    /** Tag a person in a series. */
    router.post('/:id/series-tags', (req, res) => {
        const { seriesId } = req.body as { seriesId?: string };
        if (!seriesId) {
            res.status(400).json({ error: 'seriesId is required' });
            return;
        }
        if (!findPersonById(req.params.id)) {
            res.status(404).json({ error: 'Person not found' });
            return;
        }
        if (!findSeriesById(seriesId)) {
            res.status(404).json({ error: 'Series not found' });
            return;
        }
        const userId = (req as unknown as { user?: { id: string } }).user?.id;
        try {
            const subject = addSeriesSubject(seriesId, req.params.id, userId);
            res.status(201).json(subject);
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes('UNIQUE')) {
                res.status(409).json({ error: 'Person already tagged in this series' });
            } else {
                res.status(500).json({ error: 'Failed to tag person in series' });
            }
        }
    });

    /** Remove a person tag from a series. */
    router.delete('/:id/series-tags/:seriesId', (req, res) => {
        if (!removeSeriesSubject(req.params.seriesId, req.params.id)) {
            res.status(404).json({ error: 'Tag not found' });
            return;
        }
        res.status(204).end();
    });

    return router;
}
