import type { Photo } from '@/app/features/photos/models/photos.models';

/** How the viewer shows a file from an album. */
export type FileKind = 'image' | 'pdf' | 'text' | 'video' | 'audio' | 'other';

type FileInfo = Pick<Photo, 'name' | 'mimeType'>;

/** OneDrive often labels these as generic binary, so the extension decides. */
const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.tsv', '.log'];

export function fileKind(file: FileInfo): FileKind {
    const mime = file.mimeType;
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('text/')) return 'text';
    const name = file.name.toLowerCase();
    if (TEXT_EXTENSIONS.some((ext) => name.endsWith(ext))) return 'text';
    return 'other';
}

/** Whether a file is a picture, shown in the zoomable viewer; anything else is a document. */
export function isImageFile(file: FileInfo): boolean {
    return fileKind(file) === 'image';
}

/** The file's extension in capitals ("PDF", "DOCX"), for badges; "FILE" when it has none. */
export function fileTypeLabel(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toUpperCase() : 'FILE';
}

/** The file's bytes through the server, shown in place or, with `download`, saved. */
export function fileContentUrl(folderId: string, file: Pick<Photo, 'id' | 'name'>, download = false): string {
    // The trailing name is for the browser, which titles a PDF and names a saved copy after the URL.
    const url = `/api/folders/${encodeURIComponent(folderId)}/files/${encodeURIComponent(file.id)}/content/${encodeURIComponent(file.name)}`;
    return download ? `${url}?download=1` : url;
}
