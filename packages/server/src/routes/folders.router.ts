import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import { getFeaturedAlbum } from '../db/featured.store.js';
import { clearFolderCover, getAllFolderCovers, getFolderCover, setFolderCover } from '../db/folder-covers.store.js';
import { findFolderBySlug as storeFindFolderBySlug, listFolders, type StoredFolder } from '../db/folders.store.js';
import { findPhotoByFolderAndName, type StoredPhoto } from '../db/photos.store.js';
import { getRatingsByUserForPhotos } from '../db/ratings.store.js';
import { getRelationsForPhoto } from '../db/relations.store.js';
import { getFeaturedTaggedPhotos } from '../services/featured-photos.service.js';
import { isInPagesSubfolder, OneDriveService, pagesOwnerPath, type Photo as OneDrivePhoto } from '../services/onedrive.service.js';
import { isGalleryFile } from '../services/tagged-photos.service.js';
import { ThumbnailCacheService } from '../services/thumbnail-cache.service.js';

function findFolderBySlug(slug: string | string[] | undefined): StoredFolder | null {
    if (typeof slug !== 'string') return null;
    return storeFindFolderBySlug(slug) ?? null;
}

/**
 * How a cover is recorded: the photo's path relative to the folder it is the cover of, so the
 * album cover can come from a subfolder without colliding with a same-named file elsewhere.
 * Covers saved before subfolders could be browsed are plain file names; those still match.
 */
function coverName(photo: OneDrivePhoto, scopePath: string): string {
    const rel = scopePath ? photo.subfolderPath.slice(scopePath.length + 1) : photo.subfolderPath;
    return rel ? `${rel}/${photo.name}` : photo.name;
}

/** Mirror of the client's pickCover: prefer the admin-configured cover, else the first
 *  photo that is uncataloged, or cataloged-without-bundle, or a preferred front.
 *  `scopePath` is the subfolder the cover belongs to ('' for the album itself). */
export function pickCoverPhoto(
    photos: OneDrivePhoto[],
    folderPath: string,
    coverFileName: string | undefined,
    scopePath = '',
): OneDrivePhoto | null {
    if (coverFileName) {
        const chosen =
            photos.find((p) => coverName(p, scopePath) === coverFileName) ?? photos.find((p) => p.name === coverFileName);
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

/** A OneDrive photo as galleries receive it, joined with its catalog row when it has one.
 *  `ratings` holds the requesting user's ratings by catalog id. */
export function toClientPhoto(photo: OneDrivePhoto, cataloged: StoredPhoto | undefined, ratings: Map<string, number>) {
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
        rating: ratings.get(cataloged.id) ?? null,
    };
}

/** A client-supplied subfolder path, relative to the album root, with stray slashes removed. */
function normalizeSubfolderPath(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.split('/').filter(Boolean).join('/');
}

/** Paths come from OneDrive (case-insensitive) and from URLs, so compare without case. */
function samePath(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
}

/** The folder_covers key for a subfolder of an album ('' is the album itself). */
function coverKey(folder: StoredFolder, subfolderPath: string): string {
    return subfolderPath ? `${folder.folderPath}/${subfolderPath}` : folder.folderPath;
}

/**
 * Group an album's photos by the immediate subfolder of `parent` they live under, in name order.
 * Each group holds every photo in that subfolder's tree, pages included. Pages folders are not
 * groups of their own: they open from their parent's Pages button instead.
 */
function childFolders(photos: OneDrivePhoto[], parent: string): { name: string; path: string; photos: OneDrivePhoto[] }[] {
    const prefix = parent ? `${parent.toLowerCase()}/` : '';
    const byName = new Map<string, { name: string; path: string; photos: OneDrivePhoto[] }>();
    for (const p of photos) {
        if (!p.subfolderPath.toLowerCase().startsWith(prefix)) continue;
        const name = p.subfolderPath.slice(prefix.length).split('/')[0];
        if (!name || name.toLowerCase() === 'pages') continue;
        const key = name.toLowerCase();
        let group = byName.get(key);
        if (!group) {
            group = { name, path: parent ? `${parent}/${name}` : name, photos: [] };
            byName.set(key, group);
        }
        group.photos.push(p);
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export interface SubfolderSummary {
    name: string;
    /** Path from the album root, used as the `path` query parameter to open it. */
    path: string;
    /** Gallery photos anywhere in the subfolder's tree. */
    photoCount: number;
    subfolderCount: number;
    coverUrl: string | null;
}

/** Tiles for the immediate subfolders of `parent` in a browse-mode album. */
function summarizeSubfolders(
    folder: StoredFolder,
    photos: OneDrivePhoto[],
    parent: string,
    covers: Map<string, string>,
): SubfolderSummary[] {
    return childFolders(photos, parent).map((child) => {
        const galleryPhotos = child.photos.filter((p) => !isInPagesSubfolder(p.subfolderPath));
        const cover = pickCoverPhoto(galleryPhotos, folder.folderPath, covers.get(coverKey(folder, child.path)), child.path);
        return {
            name: child.name,
            path: child.path,
            photoCount: galleryPhotos.length,
            subfolderCount: childFolders(child.photos, child.path).length,
            coverUrl: cover ? `/api/folders/${folder.slug}/cover/${encodeURIComponent(cover.id)}` : null,
        };
    });
}

export function createFoldersRouter(oneDriveService: OneDriveService, thumbnailCache: ThumbnailCacheService): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        const covers = getAllFolderCovers();
        const result = listFolders()
            .map((f) => ({
                id: f.slug,
                displayName: f.displayName,
                coverFileName: covers.get(f.folderPath),
                subfolderMode: f.subfolderMode,
                tags: f.tags,
                createdAt: f.createdAt,
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
                    const rawPhotos = await oneDriveService.getPhotos(f.sharingUrl);
                    // Gallery photos: exclude the pages subfolder
                    const galleryPhotos = rawPhotos.filter((p) => !isInPagesSubfolder(p.subfolderPath));
                    const hasPagesSubfolder = rawPhotos.some((p) => isInPagesSubfolder(p.subfolderPath));
                    const cover = pickCoverPhoto(galleryPhotos, f.folderPath, covers.get(f.folderPath));
                    return {
                        folderId: f.slug,
                        coverUrl: cover ? `/api/folders/${f.slug}/cover/${encodeURIComponent(cover.id)}` : null,
                        photoCount: galleryPhotos.length,
                        subfolderCount: f.subfolderMode === 'browse' ? childFolders(rawPhotos, '').length : 0,
                        hasPagesSubfolder,
                    };
                } catch (err) {
                    console.error(`Cover resolve failed for folder ${f.slug}:`, err);
                    return { folderId: f.slug, coverUrl: null, photoCount: 0, subfolderCount: 0, hasPagesSubfolder: false };
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

        const viewParam = req.query.view;
        const pagesView = viewParam === 'pages';
        // A flatten album is one gallery (plus one merged Pages view), so it ignores `path`. A
        // browse album shows only what sits directly in `path`, plus tiles for its subfolders.
        // `flat=1` asks for a browse album flattened, for pickers that need every photo.
        const browse = folder.subfolderMode === 'browse' && req.query.flat !== '1';
        const path = browse ? normalizeSubfolderPath(req.query.path) : '';

        try {
            const rawPhotos = await oneDriveService.getPhotos(folder.sharingUrl);

            const ownsPages = (owner: string | null) => owner !== null && (!browse || samePath(owner, path));
            const hasPagesSubfolder = rawPhotos.some((p) => ownsPages(pagesOwnerPath(p.subfolderPath)));

            // Select the relevant slice: pages only, or everything else.
            const photos = rawPhotos.filter((p) => {
                const owner = pagesOwnerPath(p.subfolderPath);
                if (pagesView) return ownsPages(owner);
                return owner === null && (!browse || samePath(p.subfolderPath, path));
            });
            const subfolders = browse && !pagesView ? summarizeSubfolders(folder, rawPhotos, path, getAllFolderCovers()) : [];

            // Enrich each OneDrive photo with local catalog data by matching
            // on (folderPath, fileName). Photos in subfolders contribute their
            // `subfolderPath` so the join key is the full directory each photo lives in.
            const lookUp = (p: OneDrivePhoto) => {
                const fullFolder = p.subfolderPath ? `${folder.folderPath}/${p.subfolderPath}` : folder.folderPath;
                return { photo: p, cataloged: findPhotoByFolderAndName(fullFolder, p.name) };
            };
            const withCatalog = photos.map(lookUp);

            // The live featured album is followed by photos of its featured people from other albums,
            // shown once at the album root.
            const featured = getFeaturedAlbum();
            const isFeatured = !pagesView && !path && featured.enabled && featured.folderSlug === folder.slug;
            // In a browse album the album's own photos span every subfolder, not just the root.
            const albumPhotos =
                isFeatured && browse ? rawPhotos.filter((p) => !isInPagesSubfolder(p.subfolderPath)).map(lookUp) : withCatalog;
            // Only bundles the album itself shows; one with just its back here still follows as tagged.
            const albumBundles = new Set(
                albumPhotos.flatMap(({ cataloged }) => (cataloged?.bundleId && isGalleryFile(cataloged) ? [cataloged.bundleId] : [])),
            );
            const tagged = isFeatured ? await getFeaturedTaggedPhotos(oneDriveService, albumBundles) : [];

            const catalogedIds = [...withCatalog, ...tagged].map((x) => x.cataloged?.id).filter((id): id is string => !!id);
            const myRatings = getRatingsByUserForPhotos(req.user!.userId, catalogedIds);

            const enrich = (photo: OneDrivePhoto, cataloged: StoredPhoto | undefined) => toClientPhoto(photo, cataloged, myRatings);
            const enriched = [
                ...withCatalog.map(({ photo, cataloged }) => enrich(photo, cataloged)),
                ...tagged.map(({ folder: source, photo, cataloged }) => ({
                    ...enrich(photo, cataloged),
                    sourceFolderId: source.slug,
                    sourceFolderDisplayName: source.displayName,
                })),
            ];
            const featuredPersonNames = isFeatured ? featured.persons.map((p) => p.fullName) : undefined;

            const coverFileName = getFolderCover(coverKey(folder, path));

            res.json({ photos: enriched, hasPagesSubfolder, featuredPersonNames, subfolders, coverFileName });
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

    /** `?path=` targets a subfolder of a browse album; without it the cover is the album's own. */
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
        setFolderCover(coverKey(folder, normalizeSubfolderPath(req.query.path)), fileName, req.user!.userId);
        res.json({ folderId: folder.slug, coverFileName: fileName });
    });

    router.delete('/:folderId/cover', requireAdmin, (req, res) => {
        const folder = findFolderBySlug(req.params.folderId);
        if (!folder) {
            res.status(404).json({ error: 'Folder not found' });
            return;
        }
        clearFolderCover(coverKey(folder, normalizeSubfolderPath(req.query.path)));
        res.json({ folderId: folder.slug, coverFileName: null });
    });

    return router;
}
