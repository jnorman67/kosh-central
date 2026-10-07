import { Router } from 'express';
import { getFolderCover } from '../db/folder-covers.store.js';
import { getFeaturedAlbum } from '../db/featured.store.js';
import { findFolderBySlug } from '../db/folders.store.js';
import { findPhotoByFolderAndName } from '../db/photos.store.js';
import { getFeaturedTaggedPhotos, isGalleryFile } from '../services/featured-photos.service.js';
import { isInPagesSubfolder, OneDriveService } from '../services/onedrive.service.js';
import { pickCoverPhoto } from './folders.router.js';

export function createFeaturedRouter(oneDriveService: OneDriveService): Router {
    const router = Router();

    /** The featured album as users see it. Returns `{ enabled: false }` when switched off or
     *  when its album has been deleted, so the client can skip straight to the viewer. */
    router.get('/', async (_req, res) => {
        const config = getFeaturedAlbum();
        const folder = config.folderSlug ? findFolderBySlug(config.folderSlug) : undefined;
        if (!config.enabled || !folder) {
            res.json({ enabled: false });
            return;
        }

        // A OneDrive failure still renders the page — just without photos.
        let photos: { name: string; imageUrl: string; thumbnailUrl?: string; photoKey: string }[] = [];
        try {
            const rawPhotos = await oneDriveService.getPhotos(folder.sharingUrl);
            const galleryPhotos = rawPhotos.filter((p) => !isInPagesSubfolder(p.subfolderPath));
            const chosen = pickCoverPhoto(
                galleryPhotos,
                folder.folderPath,
                config.photoFileName ?? getFolderCover(folder.folderPath),
            );
            const withCatalog = galleryPhotos.map((p) => {
                const fullFolder = p.subfolderPath ? `${folder.folderPath}/${p.subfolderPath}` : folder.folderPath;
                return { source: p, cataloged: findPhotoByFolderAndName(fullFolder, p.name) };
            });
            // Same "one photo per bundle" rule the viewer's gallery uses, so the page doesn't
            // show photo backs or alternate scans.
            const viewable = withCatalog.filter(
                ({ source, cataloged }) => source === chosen || !cataloged?.bundleId || isGalleryFile(cataloged),
            );
            // The featured photo leads, then the rest of the album in order, wrapping around,
            // then photos of the featured people from other albums.
            const start = Math.max(0, viewable.findIndex((v) => v.source === chosen));
            const albumBundles = new Set(withCatalog.flatMap(({ cataloged }) => (cataloged?.bundleId ? [cataloged.bundleId] : [])));
            const tagged = (await getFeaturedTaggedPhotos(oneDriveService, albumBundles))
                .filter(({ cataloged }) => isGalleryFile(cataloged))
                .map(({ photo, cataloged }) => ({ source: photo, cataloged }));
            photos = [...viewable.slice(start), ...viewable.slice(0, start), ...tagged].map(({ source, cataloged }) => ({
                name: source.name,
                imageUrl: source.downloadUrl,
                thumbnailUrl: source.thumbnailUrl,
                // Matches the viewer's ?photo= key: content hash if cataloged, else file name.
                photoKey: cataloged?.contentHash ?? source.name,
            }));
        } catch (err) {
            console.error('Featured album photo resolve failed:', err);
        }

        res.json({
            enabled: true,
            theme: config.theme,
            eyebrow: config.eyebrow,
            title: config.title,
            subtitle: config.subtitle,
            message: config.message,
            buttonLabel: config.buttonLabel,
            folderId: folder.slug,
            folderDisplayName: folder.displayName,
            photos,
        });
    });

    return router;
}
