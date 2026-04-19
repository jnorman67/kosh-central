export interface PhotoFolder {
    id: string;
    displayName: string;
    /** Admin-chosen cover photo's filename within the folder. Falls back to first viewable. */
    coverFileName?: string;
}

export type RelationType = 'back-of' | 'front-of' | 'duplicate-of' | 'raw-version-of' | 'enhanced-version-of';

export interface PhotoRelation {
    id: string;
    photoId: string;
    relatedPhotoId: string;
    relationType: RelationType;
}

export interface Photo {
    id: string;
    name: string;
    downloadUrl: string;
    thumbnailUrl?: string;
    /** OneDrive web URL — opens this photo in the OneDrive UI. */
    webUrl?: string;
    mimeType: string;
    /** Catalog UUID, present when the OneDrive file matched a row in the local catalog. */
    catalogId?: string;
    contentHash?: string;
    /** Relations where this photo is the subject (e.g. 'back-of' target). */
    relations: PhotoRelation[];
    /** Current user's rating (0–5), or null if unrated. Absent for uncataloged photos. */
    rating?: number | null;
}
