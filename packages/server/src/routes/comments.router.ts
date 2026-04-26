import { Router } from 'express';
import {
    createComment,
    deleteComment,
    findCommentById,
    listCommentsForPhoto,
    type MentionInput,
    updateComment,
} from '../db/comments.store.js';
import { findPhotoById } from '../db/photos.store.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_LENGTH = 2000;
const MAX_MENTIONS = 20;

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

export function createCommentsRouter(): Router {
    const router = Router();

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
