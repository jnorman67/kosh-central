/** How an album presents its OneDrive subfolders: merged into one gallery, or as folders to drill into. */
export type SubfolderMode = 'flatten' | 'browse';

export interface PhotoFolder {
    id: string;
    displayName: string;
    /** Admin-chosen cover photo's filename within the folder. Falls back to first viewable. */
    coverFileName?: string;
    subfolderMode: SubfolderMode;
    /** Controlled vocabulary — see packages/server/src/config/folder-tags.ts. */
    tags: string[];
    createdAt: string;
}

export interface FolderCover {
    folderId: string;
    /** Stable proxy URL to the cover thumbnail; null if the folder has no photos or the
     *  OneDrive listing failed. Suitable for long-lived browser HTTP caching. */
    coverUrl: string | null;
    photoCount: number;
    /** Subfolders shown at the album root; always 0 for flatten albums. */
    subfolderCount: number;
}

/** A subfolder tile in a browse album's gallery. */
export interface Subfolder {
    name: string;
    /** Path from the album root; the viewer's `path` URL parameter. */
    path: string;
    /** Gallery photos anywhere in the subfolder's tree. */
    photoCount: number;
    subfolderCount: number;
    coverUrl: string | null;
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
    /** Path from the album root to the photo's folder; empty when it sits at the root. */
    subfolderPath: string;
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
    /** Set on photos of the featured people that follow the featured album's own photos: the
     *  album the photo actually lives in. Absent for the album's own photos. */
    sourceFolderId?: string;
    sourceFolderDisplayName?: string;
}

export interface PhotosResponse {
    photos: Photo[];
    hasPagesSubfolder: boolean;
    /** Present when this is the live featured album: the people whose photos follow the album's own. */
    featuredPersonNames?: string[];
    /** Subfolders of the requested path. Empty for flatten albums and for the pages view. */
    subfolders: Subfolder[];
    /** Admin-chosen cover for the requested path (the album itself at the root). */
    coverFileName?: string;
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

/** Face bounding box in normalized image coordinates (0–1, origin top-left). */
export interface FaceBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
