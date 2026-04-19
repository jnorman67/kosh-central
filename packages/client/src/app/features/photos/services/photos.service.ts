import type { FavoritesPage, Photo, PhotoFolder } from '@/app/features/photos/models/photos.models';

export class PhotosService {
    async getFolders(): Promise<PhotoFolder[]> {
        const res = await fetch('/api/folders');
        if (!res.ok) throw new Error('Failed to fetch folders');
        return res.json();
    }

    async getPhotos(folderId: string): Promise<Photo[]> {
        const res = await fetch(`/api/folders/${folderId}/photos`);
        if (!res.ok) throw new Error('Failed to fetch photos');
        return res.json();
    }

    async setFolderCover(folderId: string, fileName: string): Promise<void> {
        const res = await fetch(`/api/folders/${folderId}/cover`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName }),
        });
        if (!res.ok) throw new Error('Failed to set folder cover');
    }

    async clearFolderCover(folderId: string): Promise<void> {
        const res = await fetch(`/api/folders/${folderId}/cover`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to clear folder cover');
    }

    async ratePhoto(catalogId: string, rating: number): Promise<void> {
        const res = await fetch(`/api/ratings/photo/${catalogId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating }),
        });
        if (!res.ok) throw new Error('Failed to rate photo');
    }

    async clearRating(catalogId: string): Promise<void> {
        const res = await fetch(`/api/ratings/photo/${catalogId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to clear rating');
    }

    async getFavorites(offset: number, limit: number): Promise<FavoritesPage> {
        const res = await fetch(`/api/favorites?offset=${offset}&limit=${limit}`);
        if (!res.ok) throw new Error('Failed to fetch favorites');
        return res.json();
    }

    async setPreferredPhoto(catalogId: string): Promise<void> {
        const res = await fetch(`/api/admin/photos/${catalogId}/preferred`, { method: 'PUT' });
        if (!res.ok) throw new Error('Failed to set preferred photo');
    }

    async getShareLink(folderId: string, itemId: string): Promise<string> {
        const res = await fetch(`/api/folders/${folderId}/photos/${encodeURIComponent(itemId)}/share-link`);
        if (!res.ok) throw new Error('Failed to fetch share link');
        const body = (await res.json()) as { webUrl: string };
        return body.webUrl;
    }
}
