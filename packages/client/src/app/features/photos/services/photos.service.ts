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
}
