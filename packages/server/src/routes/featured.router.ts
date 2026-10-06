import { Router } from 'express';
import { getFolderCover } from '../db/folder-covers.store.js';
import { getFeaturedAlbum } from '../db/featured.store.js';
import { findFolderBySlug } from '../db/folders.store.js';
import { findPhotoByFolderAndName } from '../db/photos.store.js';
import { OneDriveService } from '../services/onedrive.service.js';
import { isInPagesSubfolder, pickCoverPhoto } from './folders.router.js';

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

        // A OneDrive failure still renders the page — just without a photo.
        let photo: { name: string; imageUrl: string; thumbnailUrl?: string; photoKey: string } | null = null;
        try {
            const rawPhotos = await oneDriveService.getPhotos(folder.sharingUrl);
            const galleryPhotos = rawPhotos.filter((p) => !isInPagesSubfolder(p.subfolderPath));
            const chosen = pickCoverPhoto(
                galleryPhotos,
                folder.folderPath,
                config.photoFileName ?? getFolderCover(folder.folderPath),
            );
            if (chosen) {
                const fullFolder = chosen.subfolderPath ? `${folder.folderPath}/${chosen.subfolderPath}` : folder.folderPath;
                const cataloged = findPhotoByFolderAndName(fullFolder, chosen.name);
                photo = {
                    name: chosen.name,
                    imageUrl: chosen.downloadUrl,
                    thumbnailUrl: chosen.thumbnailUrl,
                    // Matches the viewer's ?photo= key: content hash if cataloged, else file name.
                    photoKey: cataloged?.contentHash ?? chosen.name,
                };
            }
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
            photo,
        });
    });

    return router;
}
