import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import { findBundleById } from '../db/bundles.store.js';
import { getPhotoLocations, listPreferredPhotosForBundle } from '../db/photos.store.js';
import { listFolders } from '../db/folders.store.js';
import { upsertOcr } from '../db/ocr.store.js';
import type { OneDriveService } from '../services/onedrive.service.js';
import { AnthropicOcrService } from '../services/anthropic-ocr.service.js';

const ocrService = new AnthropicOcrService();

/**
 * Resolve the OneDrive download URL for a cataloged photo by matching its
 * stored (folder_name, file_name) against the live OneDrive listing.
 */
async function resolveDownloadUrl(
    photoId: string,
    fileName: string,
    oneDriveService: OneDriveService,
): Promise<string | null> {
    const locations = getPhotoLocations(photoId);
    const folders = listFolders();

    for (const loc of locations) {
        if (!loc.folderName) continue;
        const folder = folders.find((f) => loc.folderName!.toLowerCase().startsWith(f.folderPath.toLowerCase()));
        if (!folder) continue;
        try {
            const photos = await oneDriveService.getPhotos(folder.sharingUrl);
            const match = photos.find((p) => {
                const fullFolder = p.subfolderPath
                    ? `${folder.folderPath}/${p.subfolderPath}`
                    : folder.folderPath;
                return (
                    fullFolder.toLowerCase() === loc.folderName!.toLowerCase() &&
                    p.name.toLowerCase() === fileName.toLowerCase()
                );
            });
            if (match) return match.downloadUrl;
        } catch {
            continue;
        }
    }
    return null;
}

export function createOcrAdminRouter(oneDriveService: OneDriveService): Router {
    const router = Router();
    router.use(requireAdmin);

    /**
     * POST /api/admin/ocr/:bundleId
     * Fetches the preferred front (and back if present), runs Claude Vision OCR,
     * stores and returns the result.
     */
    router.post('/:bundleId', async (req, res) => {
        const bundle = findBundleById(req.params.bundleId);
        if (!bundle) {
            res.status(404).json({ error: 'Bundle not found' });
            return;
        }

        const preferred = listPreferredPhotosForBundle(req.params.bundleId);
        if (preferred.length === 0) {
            res.status(422).json({ error: 'Bundle has no preferred photos' });
            return;
        }

        try {
            const urlResults = await Promise.all(
                preferred.map((p) => resolveDownloadUrl(p.id, p.fileName, oneDriveService)),
            );
            const downloadUrls = urlResults.filter((u): u is string => u !== null);

            if (downloadUrls.length === 0) {
                res.status(502).json({ error: 'Could not resolve download URLs for bundle photos' });
                return;
            }

            const text = await ocrService.extractText(downloadUrls);
            const result = upsertOcr(req.params.bundleId, text);
            res.json(result);
        } catch (err) {
            console.error('OCR error:', err);
            res.status(500).json({ error: 'OCR failed' });
        }
    });

    return router;
}
