import type { PickedPerson } from '@/app/features/photos/components/persons-picker';
import type { Photo } from '@/app/features/photos/models/photos.models';

/** Whether a gallery shows photos of any of its people, or only photos with all of them together. */
export type GalleryMatchMode = 'any' | 'all';

/** A user's own gallery of the photos tagged with chosen people, gathered from every album. */
export interface Gallery {
    id: string;
    name: string;
    matchMode: GalleryMatchMode;
    /** In the order the user listed them. */
    persons: PickedPerson[];
    createdAt: string;
    updatedAt: string;
}

export interface GalleryInput {
    name: string;
    matchMode: GalleryMatchMode;
    persons: PickedPerson[];
}

export interface GalleryCover {
    galleryId: string;
    coverUrl: string | null;
    photoCount: number;
}

export interface GalleryPhotosResponse {
    /** Every file of each photo (backs and alternate scans too), each marked with its album. */
    photos: Photo[];
}
