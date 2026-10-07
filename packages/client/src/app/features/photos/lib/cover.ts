import type { Photo } from '@/app/features/photos/models/photos.models';

/**
 * How a cover is recorded: the photo's path relative to the folder it is the cover of
 * (`scopePath`, '' for the album itself). Mirrors the server's coverName.
 */
export function coverName(photo: Photo, scopePath = ''): string {
    const rel = scopePath ? photo.subfolderPath.slice(scopePath.length + 1) : photo.subfolderPath;
    return rel ? `${rel}/${photo.name}` : photo.name;
}

/** Whether `photo` is the recorded cover. Covers saved before subfolders could be browsed are plain file names. */
export function isCoverPhoto(photo: Photo, cover: string | undefined, scopePath = ''): boolean {
    return !!cover && (cover === coverName(photo, scopePath) || cover === photo.name);
}
