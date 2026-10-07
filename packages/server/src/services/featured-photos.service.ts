import { getFeaturedPersonIds } from '../db/featured.store.js';
import { findFolderContainingPath, listFolders, type StoredFolder } from '../db/folders.store.js';
import { getBundleIdsForPersons } from '../db/persons.store.js';
import { findPhotoByFolderAndName, listFolderNamesForBundles, type StoredPhoto } from '../db/photos.store.js';
import { isInPagesSubfolder, type OneDriveService, type Photo as OneDrivePhoto } from './onedrive.service.js';

export interface FeaturedTaggedPhoto {
    /** The album this photo is shown from. */
    folder: StoredFolder;
    photo: OneDrivePhoto;
    cataloged: StoredPhoto;
}

/**
 * Photos of the featured album's people that aren't already in the album, to follow the album's
 * own photos. Every file of each tagged bundle comes back (backs and alternate scans too) so the
 * viewer can show them alongside the front; callers filter to one per bundle where needed.
 *
 * The order is stable from visit to visit: albums in their admin-defined order, then each
 * album's own photo order — so a newly tagged photo slots into its natural place rather than
 * reshuffling the rest. A bundle filed in several albums appears once, from the first of them.
 */
export async function getFeaturedTaggedPhotos(
    oneDriveService: OneDriveService,
    excludeBundleIds: ReadonlySet<string>,
): Promise<FeaturedTaggedPhoto[]> {
    const personIds = getFeaturedPersonIds();
    if (personIds.length === 0) return [];
    const bundleIds = new Set(getBundleIdsForPersons(personIds).filter((id) => !excludeBundleIds.has(id)));
    if (bundleIds.size === 0) return [];

    const slugs = new Set(listFolderNamesForBundles([...bundleIds]).map((name) => findFolderContainingPath(name)?.slug));
    const folders = listFolders().filter((f) => slugs.has(f.slug));
    const listings = await Promise.allSettled(folders.map((f) => oneDriveService.getPhotos(f.sharingUrl)));

    const ownerByBundle = new Map<string, string>();
    const result: FeaturedTaggedPhoto[] = [];
    folders.forEach((folder, i) => {
        const listing = listings[i];
        if (listing.status === 'rejected') {
            console.error(`Featured tagged photos: listing ${folder.slug} failed:`, listing.reason);
            return;
        }
        for (const photo of listing.value) {
            if (isInPagesSubfolder(photo.subfolderPath)) continue;
            const fullFolder = photo.subfolderPath ? `${folder.folderPath}/${photo.subfolderPath}` : folder.folderPath;
            const cataloged = findPhotoByFolderAndName(fullFolder, photo.name);
            const bundleId = cataloged?.bundleId;
            if (!cataloged || !bundleId || !bundleIds.has(bundleId)) continue;
            const owner = ownerByBundle.get(bundleId);
            if (owner && owner !== folder.slug) continue;
            ownerByBundle.set(bundleId, folder.slug);
            result.push({ folder, photo, cataloged });
        }
    });
    return result;
}

/** The one file per bundle that galleries show: its preferred front. */
export function isGalleryFile(cataloged: StoredPhoto): boolean {
    return cataloged.side === 'front' && cataloged.isPreferred;
}
