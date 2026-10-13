import type { PeopleLink } from '@/app/features/galleries/lib/people-link';
import type {
    Gallery,
    GalleryCover,
    GalleryInput,
    GalleryPhotosResponse,
    GalleryPreviewResponse,
} from '@/app/features/galleries/models/galleries.models';
import { apiFetch } from '@/lib/api-client';

function toBody({ persons, ...rest }: GalleryInput): string {
    return JSON.stringify({ ...rest, personIds: persons.map((p) => p.id) });
}

export class GalleriesService {
    async getGalleries(): Promise<Gallery[]> {
        return apiFetch<Gallery[]>('/api/galleries');
    }

    async getGalleryCovers(): Promise<GalleryCover[]> {
        return apiFetch<GalleryCover[]>('/api/galleries/covers');
    }

    async getGalleryPhotos(id: string): Promise<GalleryPhotosResponse> {
        return apiFetch<GalleryPhotosResponse>(`/api/galleries/${encodeURIComponent(id)}/photos`);
    }

    async getGalleryPreview({ personIds, matchMode }: PeopleLink): Promise<GalleryPreviewResponse> {
        const params = new URLSearchParams({ people: personIds.join(','), match: matchMode });
        return apiFetch<GalleryPreviewResponse>(`/api/galleries/preview?${params}`);
    }

    async createGallery(input: GalleryInput): Promise<Gallery> {
        return apiFetch<Gallery>('/api/galleries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: toBody(input),
        });
    }

    async updateGallery(id: string, input: GalleryInput): Promise<Gallery> {
        return apiFetch<Gallery>(`/api/galleries/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: toBody(input),
        });
    }

    async deleteGallery(id: string): Promise<void> {
        await apiFetch<void>(`/api/galleries/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
}
