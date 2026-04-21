export interface PhotoFolder {
    id: string;
    displayName: string;
    /** Admin-chosen cover photo's filename within the folder. Falls back to first viewable. */
    coverFileName?: string;
}

export interface FolderCover {
    folderId: string;
    /** Stable proxy URL to the cover thumbnail; null if the folder has no photos or the
     *  OneDrive listing failed. Suitable for long-lived browser HTTP caching. */
    coverUrl: string | null;
    photoCount: number;
}

export type RelationType = 'duplicate-of';

export interface PhotoRelation {
    id: string;
    photoId: string;
    relatedPhotoId: string;
    relationType: RelationType;
}

export type BundleSide = 'front' | 'back';

export interface Photo {
    id: string;
    name: string;
    downloadUrl: string;
    thumbnailUrl?: string;
    mimeType: string;
    /** Catalog UUID, present when the OneDrive file matched a row in the local catalog. */
    catalogId?: string;
    contentHash?: string;
    /** Bundle this photo belongs to (one physical photograph). Absent for uncataloged photos. */
    bundleId?: string | null;
    /** Which side of the physical photograph this file represents. */
    side?: BundleSide | null;
    /** Whether this photo is the preferred version for its (bundle, side). */
    isPreferred?: boolean;
    /** Cross-bundle relations (currently only duplicate-of). */
    relations: PhotoRelation[];
    /** Current user's rating (0–5), or null if unrated. Absent for uncataloged photos. */
    rating?: number | null;
}

export interface FavoritePhoto extends Photo {
    /** Configured folder id (index) this favorite lives in. */
    folderId: string;
    folderDisplayName: string;
}

export interface FavoritesPage {
    photos: FavoritePhoto[];
    total: number;
    offset: number;
    limit: number;
}
