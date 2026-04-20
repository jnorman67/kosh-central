import type { FavoritesPage, Photo, PhotoFolder } from '@/app/features/photos/models/photos.models';
import { apiFetch } from '@/lib/api-client';

export class PhotosService {
    async getFolders(): Promise<PhotoFolder[]> {
        return apiFetch<PhotoFolder[]>('/api/folders');
    }

    async getPhotos(folderId: string): Promise<Photo[]> {
        return apiFetch<Photo[]>(`/api/folders/${folderId}/photos`);
    }

    async setFolderCover(folderId: string, fileName: string): Promise<void> {
        await apiFetch<void>(`/api/folders/${folderId}/cover`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName }),
        });
    }

    async clearFolderCover(folderId: string): Promise<void> {
        await apiFetch<void>(`/api/folders/${folderId}/cover`, { method: 'DELETE' });
    }

    async ratePhoto(catalogId: string, rating: number): Promise<void> {
        await apiFetch<void>(`/api/ratings/photo/${catalogId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating }),
        });
    }

    async clearRating(catalogId: string): Promise<void> {
        await apiFetch<void>(`/api/ratings/photo/${catalogId}`, { method: 'DELETE' });
    }

    async getFavorites(offset: number, limit: number): Promise<FavoritesPage> {
        return apiFetch<FavoritesPage>(`/api/favorites?offset=${offset}&limit=${limit}`);
    }

    async setPreferredPhoto(catalogId: string): Promise<void> {
        await apiFetch<void>(`/api/admin/photos/${catalogId}/preferred`, { method: 'PUT' });
    }

    async getShareLink(folderId: string, itemId: string): Promise<string> {
        const body = await apiFetch<{ webUrl: string }>(`/api/folders/${folderId}/photos/${encodeURIComponent(itemId)}/share-link`);
        return body.webUrl;
    }
}
