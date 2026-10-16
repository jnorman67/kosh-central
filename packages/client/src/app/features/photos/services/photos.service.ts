import type { FaceBox, FavoritesPage, FolderCover, PhotoFolder, PhotosResponse } from '@/app/features/photos/models/photos.models';
import { ApiError, apiFetch } from '@/lib/api-client';

/** Larger text files are previewed only up to here. */
const TEXT_PREVIEW_BYTES = 1024 * 1024;

export interface TextFile {
    text: string;
    /** The file runs past what the preview shows. */
    truncated: boolean;
}

function pathQuery(path: string): string {
    return path ? `?${new URLSearchParams({ path })}` : '';
}

export class PhotosService {
    async getFolders(): Promise<PhotoFolder[]> {
        return apiFetch<PhotoFolder[]>('/api/folders');
    }

    async getFolderCovers(): Promise<FolderCover[]> {
        return apiFetch<FolderCover[]>('/api/folders/covers');
    }

    async getPhotos(folderId: string, view: 'gallery' | 'pages' = 'gallery', path = ''): Promise<PhotosResponse> {
        const params = new URLSearchParams({ view });
        if (path) params.set('path', path);
        return apiFetch<PhotosResponse>(`/api/folders/${folderId}/photos?${params}`);
    }

    /** Every photo in the album, subfolders included, whatever its subfolder mode — for pickers. */
    async getAllPhotos(folderId: string): Promise<PhotosResponse> {
        return apiFetch<PhotosResponse>(`/api/folders/${folderId}/photos?view=gallery&flat=1`);
    }

    /** `path` targets a subfolder of a browse album; empty sets the album's own cover. */
    async setFolderCover(folderId: string, fileName: string, path = ''): Promise<void> {
        await apiFetch<void>(`/api/folders/${folderId}/cover${pathQuery(path)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName }),
        });
    }

    async clearFolderCover(folderId: string, path = ''): Promise<void> {
        await apiFetch<void>(`/api/folders/${folderId}/cover${pathQuery(path)}`, { method: 'DELETE' });
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

    async getShareLink(folderId: string, itemId: string): Promise<string> {
        const body = await apiFetch<{ webUrl: string }>(`/api/folders/${folderId}/photos/${encodeURIComponent(itemId)}/share-link`);
        return body.webUrl;
    }

    /** A text file's contents, read as UTF-8, or as Windows-1252 when it isn't valid UTF-8 (older files often aren't). */
    async getTextFile(url: string): Promise<TextFile> {
        const res = await fetch(url);
        if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const shown = bytes.subarray(0, TEXT_PREVIEW_BYTES);
        const truncated = bytes.length > shown.length;
        let text: string;
        try {
            // A cut can split a multi-byte character, so only a whole file is decoded strictly.
            text = new TextDecoder('utf-8', { fatal: !truncated }).decode(shown);
        } catch {
            text = new TextDecoder('windows-1252').decode(shown);
        }
        return { text, truncated };
    }

    async getFaces(photoId: string): Promise<FaceBox[]> {
        return apiFetch<FaceBox[]>(`/api/photos/${photoId}/faces`);
    }
}
