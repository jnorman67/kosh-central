import type { Photo, PhotoFolder } from '@/app/features/photos/models/photos.models';

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
}
