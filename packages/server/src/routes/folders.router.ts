import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import { clearFolderCover, getAllFolderCovers, setFolderCover } from '../db/folder-covers.store.js';
import { findFolderBySlug as storeFindFolderBySlug, listFolders, type StoredFolder } from '../db/folders.store.js';
import { findPhotoByFolderAndName } from '../db/photos.store.js';
import { getRatingsByUserForPhotos } from '../db/ratings.store.js';
import { getRelationsForPhoto } from '../db/relations.store.js';
import { OneDriveService, type Photo as OneDrivePhoto } from '../services/onedrive.service.js';
import { ThumbnailCacheService } from '../services/thumbnail-cache.service.js';

function findFolderBySlug(slug: string | string[] | undefined): StoredFolder | null {
    if (typeof slug !== 'string') return null;
    return storeFindFolderBySlug(slug) ?? null;
}

/** Mirror of the client's pickCover: prefer the admin-configured cover, else the first
 *  photo that is uncataloged, or cataloged-without-bundle, or a preferred front. */
function pickCoverPhoto(
    photos: OneDrivePhoto[],
    folderPath: string,
    coverFileName: string | undefined,
): OneDrivePhoto | null {
    if (coverFileName) {
        const chosen = photos.find((p) => p.name === coverFileName);
        if (chosen) return chosen;
    }
    for (const p of photos) {
        const fullFolder = p.subfolderPath ? `${folderPath}/${p.subfolderPath}` : folderPath;
        const cat = findPhotoByFolderAndName(fullFolder, p.name);
        if (!cat) return p;
        if (!cat.bundleId) return p;
        if (cat.side === 'front' && cat.isPreferred) return p;
    }
    return photos[0] ?? null;
}

export function createFoldersRouter(oneDriveService: OneDriveService, thumbnailCache: ThumbnailCacheService): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        const covers = getAllFolderCovers();
        const result = listFolders().map((f) => ({
            id: f.slug,
            displayName: f.displayName,
            coverFileName: covers.get(f.folderPath),
        }));
        res.json(result);
    });

    /** Resolve each folder's cover + photo count in one round trip. The coverUrl is a stable
     *  proxy URL (below) so the browser HTTP cache can hold onto the image indefinitely. */
    router.get('/covers', async (_req, res) => {
        const folders = listFolders();
        const covers = getAllFolderCovers();
        const results = await Promise.all(
            folders.map(async (f) => {
                try {
                    const photos = await oneDriveService.getPhotos(f.sharingUrl);
                    const cover = pickCoverPhoto(photos, f.folderPath, covers.get(f.folderPath));
                    return {
                        folderId: f.slug,
                        coverUrl: cover ? `/api/folders/${f.slug}/cover/${encodeURIComponent(cover.id)}` : null,
                        photoCount: photos.length,
                    };
                } catch (err) {
                    console.error(`Cover resolve failed for folder ${f.slug}:`, err);
                    return { folderId: f.slug, coverUrl: null, photoCount: 0 };
                }
            }),
        );
        res.json(results);
    });

    /** Proxy for a cover thumbnail. Bytes are cached on disk keyed by OneDrive item id;
     *  the URL is considered immutable for that id, so we set a one-year Cache-Control. If
     *  the photo is later replaced, its id changes and the /covers response points at a new
     *  URL — the browser naturally fetches fresh bytes without any explicit invalidation. */
    router.get('/:folderId/cover/:itemId', async (req, res) => {
        const folder = findFolderBySlug(req.params.folderId);
        if (!folder) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        const itemId = req.params.itemId;

        const cached = thumbnailCache.read(itemId);
        if (cached) {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
            res.send(cached);
            return;
        }

        try {
            const photos = await oneDriveService.getPhotos(folder.sharingUrl);
            const photo = photos.find((p) => p.id === itemId);
            if (!photo?.thumbnailUrl) {
                res.status(404).json({ error: 'Cover not found' });
                return;
            }
            const upstream = await fetch(photo.thumbnailUrl);
            if (!upstream.ok) {
                res.status(502).json({ error: `Upstream thumbnail fetch failed: ${upstream.status}` });
                return;
            }
            const buf = Buffer.from(await upstream.arrayBuffer());
            thumbnailCache.write(itemId, buf);
            res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');
            res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
            res.send(buf);
        } catch (err) {
            console.error('Cover proxy error:', err);
            res.status(502).json({ error: 'Failed to fetch cover' });
        }
    });

    router.get('/:folderId/photos', async (req, res) => {
        const folder = findFolderBySlug(req.params.folderId);
        if (!folder) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        try {
            const photos = await oneDriveService.getPhotos(folder.sharingUrl);

            // Enrich each OneDrive photo with local catalog data by matching
            // on (folderPath, fileName). See README "Local Catalog & Matching
            // Strategy" for why name-based matching is the current approach.
            // Photos in subfolders contribute their `subfolderPath` so the
            // join key is the full directory each photo actually lives in.
            const withCatalog = photos.map((p) => {
                const fullFolder = p.subfolderPath ? `${folder.folderPath}/${p.subfolderPath}` : folder.folderPath;
                const cataloged = findPhotoByFolderAndName(fullFolder, p.name);
                return { photo: p, cataloged };
            });

            const catalogedIds = withCatalog.map((x) => x.cataloged?.id).filter((id): id is string => !!id);
            const myRatings = getRatingsByUserForPhotos(req.user!.userId, catalogedIds);

            const enriched = withCatalog.map(({ photo, cataloged }) => {
                // Strip driveId — it's server-internal, only used for creating share links.
                const { driveId: _driveId, ...rest } = photo;
                if (!cataloged) return { ...rest, relations: [] };
                return {
                    ...rest,
                    catalogId: cataloged.id,
                    contentHash: cataloged.contentHash,
                    bundleId: cataloged.bundleId,
                    side: cataloged.side,
                    isPreferred: cataloged.isPreferred,
                    relations: getRelationsForPhoto(cataloged.id),
                    rating: myRatings.get(cataloged.id) ?? null,
                };
            });

            res.json(enriched);
        } catch (err) {
            console.error('OneDrive error:', err);
            res.status(502).json({ error: 'Failed to fetch photos from OneDrive' });
        }
    });

    router.get('/:folderId/photos/:itemId/share-link', async (req, res) => {
        const folder = findFolderBySlug(req.params.folderId);
        if (!folder) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        try {
            const photos = await oneDriveService.getPhotos(folder.sharingUrl);
            const photo = photos.find((p) => p.id === req.params.itemId);
            if (!photo) {
                res.status(404).json({ error: 'Photo not found in folder' });
                return;
            }
            const webUrl = await oneDriveService.getOrCreateShareLink(photo.driveId, photo.id);
            res.json({ webUrl });
        } catch (err) {
            console.error('Share link error:', err);
            res.status(502).json({ error: 'Failed to create share link' });
        }
    });

    router.put('/:folderId/cover', requireAdmin, (req, res) => {
        const folder = findFolderBySlug(req.params.folderId);
        if (!folder) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        const { fileName } = req.body as { fileName?: unknown };
        if (typeof fileName !== 'string' || fileName.length === 0) {
            res.status(400).json({ error: 'fileName is required' });
            return;
        }
        setFolderCover(folder.folderPath, fileName, req.user!.userId);
        res.json({ folderId: folder.slug, coverFileName: fileName });
    });

    router.delete('/:folderId/cover', requireAdmin, (req, res) => {
        const folder = findFolderBySlug(req.params.folderId);
        if (!folder) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        clearFolderCover(folder.folderPath);
        res.json({ folderId: folder.slug, coverFileName: null });
    });

    return router;
}
