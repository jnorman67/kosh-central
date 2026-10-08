import { getFeaturedPersonIds } from '../db/featured.store.js';
import { getBundleIdsForPersons } from '../db/persons.store.js';
import type { OneDriveService } from './onedrive.service.js';
import { getPhotosOfBundles, type TaggedPhoto } from './tagged-photos.service.js';

/**
 * Photos of the featured album's people that aren't already in the album, to follow the album's
 * own photos, in the stable cross-album order `getPhotosOfBundles` gives.
 *
 * `excludeBundleIds` should hold only bundles the album itself shows (its gallery file is there);
 * a bundle with just its back in the album would otherwise be shown nowhere.
 */
export async function getFeaturedTaggedPhotos(
    oneDriveService: OneDriveService,
    excludeBundleIds: ReadonlySet<string>,
): Promise<TaggedPhoto[]> {
    const personIds = getFeaturedPersonIds();
    if (personIds.length === 0) return [];
    const bundleIds = new Set(getBundleIdsForPersons(personIds).filter((id) => !excludeBundleIds.has(id)));
    return getPhotosOfBundles(oneDriveService, bundleIds);
}
