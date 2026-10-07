import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import {
    FEATURED_THEMES,
    getFeaturedAlbum,
    isFeaturedTheme,
    updateFeaturedAlbum,
    type FeaturedAlbumInput,
} from '../db/featured.store.js';
import { findFolderBySlug } from '../db/folders.store.js';
import { findPersonById } from '../db/persons.store.js';

const SHORT_TEXT_MAX = 200;
const MESSAGE_MAX = 5000;
const PERSONS_MAX = 50;

interface FieldError {
    error: string;
    field?: string;
}

function validate(body: unknown): FeaturedAlbumInput | FieldError {
    if (!body || typeof body !== 'object') return { error: 'Request body must be an object' };
    const b = body as Record<string, unknown>;

    const text = (key: string): string => (typeof b[key] === 'string' ? (b[key] as string).trim() : '');
    const optionalText = (key: string): string | null => text(key) || null;

    const input: FeaturedAlbumInput = {
        enabled: b.enabled === true,
        folderSlug: optionalText('folderSlug'),
        photoFileName: optionalText('photoFileName'),
        theme: isFeaturedTheme(b.theme) ? b.theme : 'classic',
        eyebrow: text('eyebrow'),
        title: text('title'),
        subtitle: text('subtitle'),
        message: text('message'),
        buttonLabel: text('buttonLabel'),
        personIds: [],
    };

    if (b.personIds !== undefined) {
        if (!Array.isArray(b.personIds) || !b.personIds.every((id) => typeof id === 'string')) {
            return { error: 'personIds must be an array of person ids', field: 'personIds' };
        }
        input.personIds = [...new Set(b.personIds as string[])];
        if (input.personIds.length > PERSONS_MAX) {
            return { error: `At most ${PERSONS_MAX} people can be featured`, field: 'personIds' };
        }
        if (input.personIds.some((id) => !findPersonById(id))) {
            return { error: 'Person not found', field: 'personIds' };
        }
    }

    if (b.theme !== undefined && !isFeaturedTheme(b.theme)) {
        return { error: `theme must be one of: ${FEATURED_THEMES.join(', ')}`, field: 'theme' };
    }
    for (const field of ['eyebrow', 'title', 'subtitle', 'buttonLabel'] as const) {
        if (input[field].length > SHORT_TEXT_MAX) {
            return { error: `${field} must be at most ${SHORT_TEXT_MAX} characters`, field };
        }
    }
    if (input.message.length > MESSAGE_MAX) {
        return { error: `message must be at most ${MESSAGE_MAX} characters`, field: 'message' };
    }
    if (input.folderSlug && !findFolderBySlug(input.folderSlug)) {
        return { error: 'Album not found', field: 'folderSlug' };
    }
    // A switched-off draft may be incomplete; a live one needs an album and a title.
    if (input.enabled) {
        if (!input.folderSlug) return { error: 'Choose an album before turning this on', field: 'folderSlug' };
        if (!input.title) return { error: 'A title is required before turning this on', field: 'title' };
    }
    // The featured photo only makes sense within its album.
    if (!input.folderSlug) input.photoFileName = null;

    return input;
}

export function createFeaturedAdminRouter(): Router {
    const router = Router();
    router.use(requireAdmin);

    router.get('/', (_req, res) => {
        res.json(getFeaturedAlbum());
    });

    router.put('/', (req, res) => {
        const parsed = validate(req.body);
        if ('error' in parsed) {
            res.status(400).json(parsed);
            return;
        }
        res.json(updateFeaturedAlbum(parsed, req.user!.userId));
    });

    return router;
}
