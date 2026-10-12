import { Router } from 'express';
import {
    countUnseenActiveBundles,
    createComment,
    deleteComment,
    findCommentById,
    getActivitySeenAt,
    listActiveBundles,
    listCommentsForPhoto,
    listRecentCommentsForBundles,
    markActivitySeen,
    type ActivityCursor,
    type MentionInput,
    updateComment,
} from '../db/comments.store.js';
import { findPhotoById } from '../db/photos.store.js';
import type { OneDriveService } from '../services/onedrive.service.js';
import { getPhotosOfBundles, isGalleryFile, type TaggedPhoto } from '../services/tagged-photos.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_LENGTH = 2000;
const MAX_MENTIONS = 20;
const ACTIVITY_PAGE_SIZE = 8;
const ACTIVITY_PAGE_MAX = 30;
/** How many of each photo's latest comments the activity feed shows; the rest open in the viewer. */
const ACTIVITY_COMMENTS_PER_PHOTO = 3;
const SQL_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function validateBody(body: string): string | null {
    if (!body || body.trim().length === 0) return 'body is required';
    if (body.length > MAX_BODY_LENGTH) return `body must be ${MAX_BODY_LENGTH} characters or fewer`;
    return null;
}

function validateMentionInputs(mentions: unknown): { valid: MentionInput[] } | { error: string } {
    if (!Array.isArray(mentions)) return { valid: [] };
    if (mentions.length > MAX_MENTIONS) return { error: `mentions must have ${MAX_MENTIONS} entries or fewer` };
    const valid: MentionInput[] = [];
    for (const m of mentions) {
        if (
            typeof m !== 'object' ||
            m === null ||
            !['user', 'person'].includes(m.mentionType) ||
            typeof m.mentionedId !== 'string' ||
            !UUID_RE.test(m.mentionedId)
        ) {
            return { error: 'invalid mention entry' };
        }
        valid.push({ mentionType: m.mentionType, mentionedId: m.mentionedId });
    }
    return { valid };
}

/** Cursors are `<lastCommentAt>|<bundleId>`, as the previous page's `nextCursor` gave them. */
function parseCursor(raw: unknown): ActivityCursor | null | 'invalid' {
    if (raw === undefined || raw === '') return null;
    if (typeof raw !== 'string') return 'invalid';
    const [lastCommentAt, bundleId, ...rest] = raw.split('|');
    if (rest.length > 0 || !SQL_DATETIME_RE.test(lastCommentAt) || !bundleId) return 'invalid';
    return { lastCommentAt, bundleId };
}

/** The file each bundle is shown by: its gallery file where an album holds it, else any file of it. */
function pickShownFiles(tagged: TaggedPhoto[]): Map<string, TaggedPhoto> {
    const byBundle = new Map<string, TaggedPhoto>();
    for (const t of tagged) {
        const bundleId = t.cataloged.bundleId!;
        const current = byBundle.get(bundleId);
        if (!current || (!isGalleryFile(current.cataloged) && isGalleryFile(t.cataloged))) byBundle.set(bundleId, t);
    }
    return byBundle;
}

export function createCommentsRouter(oneDriveService: OneDriveService): Router {
    const router = Router();

    /**
     * The activity feed: commented photos, most recently commented first, each with its latest
     * few comments and where it lives so the client can open it in the viewer. Photos no album
     * lists any more are left out, so a page can come back short while `nextCursor` still leads on.
     */
    router.get('/activity', async (req, res) => {
        const cursor = parseCursor(req.query.cursor);
        if (cursor === 'invalid') {
            res.status(400).json({ error: 'Invalid cursor' });
            return;
        }
        const requested = Number(req.query.limit ?? ACTIVITY_PAGE_SIZE);
        const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, ACTIVITY_PAGE_MAX) : ACTIVITY_PAGE_SIZE;

        // One extra row says whether another page follows.
        const rows = listActiveBundles(cursor, limit + 1);
        const page = rows.slice(0, limit);
        const last = page[page.length - 1];
        const nextCursor = rows.length > limit && last ? `${last.lastCommentAt}|${last.bundleId}` : null;

        try {
            const shown = pickShownFiles(await getPhotosOfBundles(oneDriveService, new Set(page.map((b) => b.bundleId))));
            const photoIdByBundle = new Map([...shown].map(([bundleId, t]) => [bundleId, t.cataloged.id]));
            const comments = listRecentCommentsForBundles(photoIdByBundle, ACTIVITY_COMMENTS_PER_PHOTO);

            const items = page.flatMap((bundle) => {
                const file = shown.get(bundle.bundleId);
                if (!file) return [];
                const { folder, photo, cataloged } = file;
                return [
                    {
                        ...bundle,
                        photo: {
                            catalogId: cataloged.id,
                            name: photo.name,
                            imageUrl: `/api/folders/${folder.slug}/cover/${encodeURIComponent(photo.id)}`,
                            folderId: folder.slug,
                            folderDisplayName: folder.displayName,
                            // The viewer's `path`: browse albums open the subfolder holding the photo.
                            path: folder.subfolderMode === 'browse' ? photo.subfolderPath : '',
                            // Matches the viewer's ?photo= key: content hash if cataloged, else file name.
                            photoKey: cataloged.contentHash,
                        },
                        comments: comments.get(bundle.bundleId) ?? [],
                    },
                ];
            });
            res.json({ items, nextCursor });
        } catch (err) {
            console.error('GET /comments/activity error:', err);
            res.status(502).json({ error: 'Failed to fetch photos from OneDrive' });
        }
    });

    /** When the user last opened the feed, and how many photos others have commented on since. */
    router.get('/activity/status', (req, res) => {
        const userId = req.user!.userId;
        res.json({ seenAt: getActivitySeenAt(userId), unseenCount: countUnseenActiveBundles(userId) });
    });

    /** Mark the feed seen now. Returns the previous visit's time so the page can flag what's new since. */
    router.post('/activity/seen', (req, res) => {
        res.json({ previousSeenAt: markActivitySeen(req.user!.userId) });
    });

    router.get('/photo/:photoId', (req, res) => {
        const photo = findPhotoById(req.params.photoId);
        if (!photo) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }
        res.json(listCommentsForPhoto(req.params.photoId));
    });

    router.post('/photo/:photoId', (req, res) => {
        const photo = findPhotoById(req.params.photoId);
        if (!photo) {
            res.status(404).json({ error: 'Photo not found' });
            return;
        }

        const { body, mentions } = req.body as { body?: string; mentions?: unknown };
        const bodyError = validateBody(body ?? '');
        if (bodyError) {
            res.status(400).json({ error: bodyError });
            return;
        }

        const mentionsResult = validateMentionInputs(mentions ?? []);
        if ('error' in mentionsResult) {
            res.status(400).json({ error: mentionsResult.error });
            return;
        }

        try {
            const comment = createComment(req.params.photoId, req.user!.userId, body!.trim(), mentionsResult.valid);
            res.status(201).json(comment);
        } catch (err: unknown) {
            if (err instanceof Error && err.message.startsWith('Invalid mention:')) {
                res.status(400).json({ error: err.message });
                return;
            }
            console.error('POST /comments/photo/:photoId error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.patch('/:commentId', (req, res) => {
        const comment = findCommentById(req.params.commentId);
        if (!comment) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        if (req.user!.userId !== comment.authorId && req.user!.role !== 'admin') {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const { body, mentions } = req.body as { body?: string; mentions?: unknown };
        const bodyError = validateBody(body ?? '');
        if (bodyError) {
            res.status(400).json({ error: bodyError });
            return;
        }

        const mentionsResult = validateMentionInputs(mentions ?? []);
        if ('error' in mentionsResult) {
            res.status(400).json({ error: mentionsResult.error });
            return;
        }

        try {
            const updated = updateComment(req.params.commentId, body!.trim(), mentionsResult.valid);
            res.json(updated);
        } catch (err: unknown) {
            if (err instanceof Error && err.message.startsWith('Invalid mention:')) {
                res.status(400).json({ error: err.message });
                return;
            }
            console.error('PATCH /comments/:commentId error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.delete('/:commentId', (req, res) => {
        const comment = findCommentById(req.params.commentId);
        if (!comment) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        if (req.user!.userId !== comment.authorId && req.user!.role !== 'admin') {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        deleteComment(req.params.commentId);
        res.status(204).send();
    });

    return router;
}
