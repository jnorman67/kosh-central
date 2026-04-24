import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import { FOLDER_TAGS, isKnownFolderTag } from '../config/folder-tags.js';
import {
    createFolder,
    deleteFolder,
    findFolderBySlug,
    listFolders,
    reorderFolders,
    replaceAllFolders,
    updateFolder,
    upsertFolders,
    type FolderInput,
    type StoredFolder,
} from '../db/folders.store.js';
import { OneDriveService, ShareValidationError } from '../services/onedrive.service.js';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

interface FieldError {
    error: string;
    field?: string;
    detail?: unknown;
}

function validateShape(body: unknown): FolderInput | FieldError {
    if (!body || typeof body !== 'object') return { error: 'Request body must be an object' };
    const b = body as Record<string, unknown>;
    const slug = typeof b.slug === 'string' ? b.slug.trim() : '';
    const displayName = typeof b.displayName === 'string' ? b.displayName.trim() : '';
    const sharingUrl = typeof b.sharingUrl === 'string' ? b.sharingUrl.trim() : '';
    const folderPath = typeof b.folderPath === 'string' ? b.folderPath.trim() : '';
    const sortOrder = typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder) ? b.sortOrder : 0;

    if (!slug) return { error: 'slug is required', field: 'slug' };
    if (!SLUG_PATTERN.test(slug)) {
        return { error: 'slug must contain only lowercase letters, digits, and hyphens', field: 'slug' };
    }
    if (!displayName) return { error: 'displayName is required', field: 'displayName' };
    if (!sharingUrl) return { error: 'sharingUrl is required', field: 'sharingUrl' };
    if (!folderPath) return { error: 'folderPath is required', field: 'folderPath' };

    let tags: string[] | undefined;
    if (b.tags !== undefined) {
        if (!Array.isArray(b.tags) || !b.tags.every((t) => typeof t === 'string')) {
            return { error: 'tags must be an array of strings', field: 'tags' };
        }
        const seen = new Set<string>();
        for (const raw of b.tags as string[]) {
            const t = raw.trim();
            if (!isKnownFolderTag(t)) {
                return {
                    error: `Unknown tag "${raw}". Allowed: ${FOLDER_TAGS.join(', ')}`,
                    field: 'tags',
                };
            }
            seen.add(t);
        }
        tags = [...seen];
    }

    const createdAt = typeof b.createdAt === 'string' && b.createdAt ? b.createdAt : undefined;

    return { slug, displayName, sharingUrl, folderPath, sortOrder, tags, createdAt };
}

export function createFoldersAdminRouter(oneDriveService: OneDriveService): Router {
    const router = Router();
    router.use(requireAdmin);

    router.get('/', (_req, res) => {
        res.json(listFolders());
    });

    router.get('/export', (_req, res) => {
        const folders = listFolders();
        const filename = `folders-${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json({
            version: 1,
            exportedAt: new Date().toISOString(),
            folders,
        });
    });

    router.post('/', async (req, res) => {
        const parsed = validateShape(req.body);
        if ('error' in parsed) {
            res.status(400).json(parsed);
            return;
        }
        if (findFolderBySlug(parsed.slug)) {
            res.status(409).json({ error: 'A folder with this slug already exists', field: 'slug' });
            return;
        }
        try {
            await oneDriveService.validateSharingUrl(parsed.sharingUrl);
        } catch (err) {
            if (err instanceof ShareValidationError) {
                res.status(400).json({ error: err.message, field: 'sharingUrl', detail: err.detail });
                return;
            }
            console.error('Share URL validation error:', err);
            res.status(502).json({ error: 'Unable to reach OneDrive to validate share URL' });
            return;
        }
        try {
            const created = createFolder(parsed);
            res.status(201).json(created);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('UNIQUE constraint failed: folders.folder_path')) {
                res.status(409).json({ error: 'Another folder already uses this folderPath', field: 'folderPath' });
                return;
            }
            console.error('Create folder error:', err);
            res.status(500).json({ error: 'Failed to create folder' });
        }
    });

    router.put('/:slug', async (req, res) => {
        const existing = findFolderBySlug(req.params.slug);
        if (!existing) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        const parsed = validateShape(req.body);
        if ('error' in parsed) {
            res.status(400).json(parsed);
            return;
        }
        // Allow renaming the slug if the new slug isn't taken by a different row.
        if (parsed.slug !== existing.slug && findFolderBySlug(parsed.slug)) {
            res.status(409).json({ error: 'A folder with this slug already exists', field: 'slug' });
            return;
        }
        if (parsed.sharingUrl !== existing.sharingUrl) {
            try {
                await oneDriveService.validateSharingUrl(parsed.sharingUrl);
            } catch (err) {
                if (err instanceof ShareValidationError) {
                    res.status(400).json({ error: err.message, field: 'sharingUrl', detail: err.detail });
                    return;
                }
                console.error('Share URL validation error:', err);
                res.status(502).json({ error: 'Unable to reach OneDrive to validate share URL' });
                return;
            }
        }
        try {
            const updated = updateFolder(existing.slug, parsed);
            if (!updated) {
                res.status(404).json({ error: 'Folder not found' });
                return;
            }
            res.json(updated);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('UNIQUE constraint failed: folders.folder_path')) {
                res.status(409).json({ error: 'Another folder already uses this folderPath', field: 'folderPath' });
                return;
            }
            console.error('Update folder error:', err);
            res.status(500).json({ error: 'Failed to update folder' });
        }
    });

    router.post('/reorder', (req, res) => {
        const body = req.body as { slugs?: unknown };
        if (!Array.isArray(body.slugs) || !body.slugs.every((s) => typeof s === 'string')) {
            res.status(400).json({ error: 'Request body must have a "slugs" array of strings' });
            return;
        }
        const known = new Set(listFolders().map((f) => f.slug));
        const filtered = (body.slugs as string[]).filter((s) => known.has(s));
        reorderFolders(filtered);
        res.json(listFolders());
    });

    router.delete('/:slug', (req, res) => {
        const ok = deleteFolder(req.params.slug);
        if (!ok) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        res.status(204).end();
    });

    router.post('/import', (req, res) => {
        const body = req.body as { folders?: unknown; mode?: unknown };
        if (!Array.isArray(body.folders)) {
            res.status(400).json({ error: 'Request body must have a "folders" array' });
            return;
        }
        const mode = body.mode === 'replace' ? 'replace' : 'upsert';

        const parsed: FolderInput[] = [];
        for (let i = 0; i < body.folders.length; i++) {
            const entry = validateShape(body.folders[i]);
            if ('error' in entry) {
                res.status(400).json({ error: `folders[${i}]: ${entry.error}`, field: entry.field });
                return;
            }
            parsed.push(entry);
        }

        // Reject duplicate slugs within the payload.
        const seen = new Set<string>();
        for (const f of parsed) {
            if (seen.has(f.slug)) {
                res.status(400).json({ error: `Duplicate slug in payload: ${f.slug}`, field: 'slug' });
                return;
            }
            seen.add(f.slug);
        }
        // Reject duplicate folder_paths within the payload (case-insensitive, matching the unique index).
        const seenPaths = new Set<string>();
        for (const f of parsed) {
            const key = f.folderPath.toLowerCase();
            if (seenPaths.has(key)) {
                res.status(400).json({ error: `Duplicate folderPath in payload: ${f.folderPath}`, field: 'folderPath' });
                return;
            }
            seenPaths.add(key);
        }

        try {
            const result = mode === 'replace' ? replaceAllFolders(parsed) : upsertFolders(parsed);
            res.json({ mode, ...result });
        } catch (err) {
            console.error('Import folders error:', err);
            res.status(500).json({ error: 'Failed to import folders' });
        }
    });

    return router;
}

export type { StoredFolder };
