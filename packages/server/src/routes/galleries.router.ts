import { Router } from 'express';
import {
    createGallery,
    deleteGallery,
    findGalleryForUser,
    GALLERY_MATCH_MODES,
    isGalleryMatchMode,
    listGalleriesForUser,
    updateGallery,
    type GalleryInput,
    type StoredGallery,
} from '../db/galleries.store.js';
import { findPersonById, getBundleIdsForPersons } from '../db/persons.store.js';
import { getRatingsByUserForPhotos } from '../db/ratings.store.js';
import type { OneDriveService } from '../services/onedrive.service.js';
import { getPhotosOfBundles, isGalleryFile, type TaggedPhoto } from '../services/tagged-photos.service.js';
import { toClientPhoto } from './folders.router.js';

const NAME_MAX = 100;
const PERSONS_MAX = 50;

interface FieldError {
    error: string;
    field?: string;
}

function validate(body: unknown): GalleryInput | FieldError {
    if (!body || typeof body !== 'object') return { error: 'Request body must be an object' };
    const b = body as Record<string, unknown>;

    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!name) return { error: 'A name is required', field: 'name' };
    if (name.length > NAME_MAX) return { error: `name must be at most ${NAME_MAX} characters`, field: 'name' };

    if (b.matchMode !== undefined && !isGalleryMatchMode(b.matchMode)) {
        return { error: `matchMode must be one of: ${GALLERY_MATCH_MODES.join(', ')}`, field: 'matchMode' };
    }

    if (!Array.isArray(b.personIds) || !b.personIds.every((id) => typeof id === 'string')) {
        return { error: 'personIds must be an array of person ids', field: 'personIds' };
    }
    const personIds = [...new Set(b.personIds as string[])];
    if (personIds.length === 0) return { error: 'Choose at least one person', field: 'personIds' };
    if (personIds.length > PERSONS_MAX) return { error: `At most ${PERSONS_MAX} people per gallery`, field: 'personIds' };
    if (personIds.some((id) => !findPersonById(id))) return { error: 'Person not found', field: 'personIds' };

    return { name, matchMode: isGalleryMatchMode(b.matchMode) ? b.matchMode : 'any', personIds };
}

/** Every file of each photo the gallery covers, in the stable cross-album order. */
function resolveGalleryPhotos(oneDriveService: OneDriveService, gallery: StoredGallery): Promise<TaggedPhoto[]> {
    const bundleIds = getBundleIdsForPersons(
        gallery.persons.map((p) => p.id),
        { requireAll: gallery.matchMode === 'all' },
    );
    return getPhotosOfBundles(oneDriveService, new Set(bundleIds));
}

/** A user's own galleries of the photos tagged with chosen people. Each user sees only their own. */
export function createGalleriesRouter(oneDriveService: OneDriveService): Router {
    const router = Router();

    router.get('/', (req, res) => {
        res.json(listGalleriesForUser(req.user!.userId));
    });

    /** Each gallery's cover and photo count, for the album list's tiles. The cover is the
     *  first photo's album-cover proxy URL, so the browser and thumbnail caches serve it. */
    router.get('/covers', async (req, res) => {
        const results = await Promise.all(
            listGalleriesForUser(req.user!.userId).map(async (gallery) => {
                try {
                    const shown = (await resolveGalleryPhotos(oneDriveService, gallery)).filter(({ cataloged }) => isGalleryFile(cataloged));
                    const first = shown[0];
                    return {
                        galleryId: gallery.id,
                        coverUrl: first ? `/api/folders/${first.folder.slug}/cover/${encodeURIComponent(first.photo.id)}` : null,
                        photoCount: shown.length,
                    };
                } catch (err) {
                    console.error(`Cover resolve failed for gallery ${gallery.id}:`, err);
                    return { galleryId: gallery.id, coverUrl: null, photoCount: 0 };
                }
            }),
        );
        res.json(results);
    });

    router.post('/', (req, res) => {
        const parsed = validate(req.body);
        if ('error' in parsed) {
            res.status(400).json(parsed);
            return;
        }
        res.status(201).json(createGallery(req.user!.userId, parsed));
    });

    router.put('/:id', (req, res) => {
        const parsed = validate(req.body);
        if ('error' in parsed) {
            res.status(400).json(parsed);
            return;
        }
        const gallery = updateGallery(req.params.id, req.user!.userId, parsed);
        if (!gallery) {
            res.status(404).json({ error: 'Gallery not found' });
            return;
        }
        res.json(gallery);
    });

    router.delete('/:id', (req, res) => {
        if (!deleteGallery(req.params.id, req.user!.userId)) {
            res.status(404).json({ error: 'Gallery not found' });
            return;
        }
        res.status(204).end();
    });

    /** The gallery's photos in the same shape as an album's, each marked with the album it lives in. */
    router.get('/:id/photos', async (req, res) => {
        const gallery = findGalleryForUser(req.params.id, req.user!.userId);
        if (!gallery) {
            res.status(404).json({ error: 'Gallery not found' });
            return;
        }
        try {
            const tagged = await resolveGalleryPhotos(oneDriveService, gallery);
            const ratings = getRatingsByUserForPhotos(
                req.user!.userId,
                tagged.map(({ cataloged }) => cataloged.id),
            );
            const photos = tagged.map(({ folder, photo, cataloged }) => ({
                ...toClientPhoto(photo, cataloged, ratings),
                sourceFolderId: folder.slug,
                sourceFolderDisplayName: folder.displayName,
            }));
            res.json({ photos });
        } catch (err) {
            console.error('Gallery photos error:', err);
            res.status(502).json({ error: 'Failed to fetch photos from OneDrive' });
        }
    });

    return router;
}
