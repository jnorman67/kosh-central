import { findFolderContainingPath, listFolders, type StoredFolder } from '../db/folders.store.js';
import { findPhotoByFolderAndName, listFolderNamesForBundles, type StoredPhoto } from '../db/photos.store.js';
import { isInPagesSubfolder, type OneDriveService, type Photo as OneDrivePhoto } from './onedrive.service.js';

export interface TaggedPhoto {
    /** The album this photo is shown from. */
    folder: StoredFolder;
    photo: OneDrivePhoto;
    cataloged: StoredPhoto;
}

/**
 * The files of the given bundles, found across every album. Every file of each bundle comes back
 * (backs and alternate scans too) so the viewer can show them alongside the front; callers filter
 * to one per bundle where needed.
 *
 * The order is stable from visit to visit: albums in their admin-defined order, then each
 * album's own photo order — so a newly tagged photo slots into its natural place rather than
 * reshuffling the rest. A bundle filed in several albums appears once.
 */
export async function getPhotosOfBundles(oneDriveService: OneDriveService, bundleIds: ReadonlySet<string>): Promise<TaggedPhoto[]> {
    if (bundleIds.size === 0) return [];

    const slugs = new Set(listFolderNamesForBundles([...bundleIds]).map((name) => findFolderContainingPath(name)?.slug));
    const folders = listFolders().filter((f) => slugs.has(f.slug));
    const listings = await Promise.allSettled(folders.map((f) => oneDriveService.getPhotos(f.sharingUrl)));

    const matches: TaggedPhoto[] = [];
    // The same image filed twice (say, in two subfolders) is listed once.
    const seen = new Set<string>();
    folders.forEach((folder, i) => {
        const listing = listings[i];
        if (listing.status === 'rejected') {
            console.error(`Tagged photos: listing ${folder.slug} failed:`, listing.reason);
            return;
        }
        for (const photo of listing.value) {
            if (isInPagesSubfolder(photo.subfolderPath)) continue;
            const fullFolder = photo.subfolderPath ? `${folder.folderPath}/${photo.subfolderPath}` : folder.folderPath;
            const cataloged = findPhotoByFolderAndName(fullFolder, photo.name);
            const bundleId = cataloged?.bundleId;
            if (!cataloged || !bundleId || !bundleIds.has(bundleId) || seen.has(cataloged.id)) continue;
            seen.add(cataloged.id);
            matches.push({ folder, photo, cataloged });
        }
    });

    // A bundle filed in several albums is shown from the first one holding its gallery file, else
    // the first holding any of its files. Going by the first file alone could pick an album that has
    // only the back, and galleries would then drop the bundle altogether.
    const ownerByBundle = new Map<string, string>();
    for (const { folder, cataloged } of matches) {
        if (isGalleryFile(cataloged) && !ownerByBundle.has(cataloged.bundleId!)) ownerByBundle.set(cataloged.bundleId!, folder.slug);
    }
    for (const { folder, cataloged } of matches) {
        if (!ownerByBundle.has(cataloged.bundleId!)) ownerByBundle.set(cataloged.bundleId!, folder.slug);
    }
    return matches.filter(({ folder, cataloged }) => ownerByBundle.get(cataloged.bundleId!) === folder.slug);
}

/** The one file per bundle that galleries show: its preferred front. */
export function isGalleryFile(cataloged: StoredPhoto): boolean {
    return cataloged.side === 'front' && cataloged.isPreferred;
}
