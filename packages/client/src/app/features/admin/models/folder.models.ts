// Controlled vocabulary for folder tags. Keep in sync with
// packages/server/src/config/folder-tags.ts.
export const FOLDER_TAGS = ['album-pages', 'documents', 'videos', 'ignore'] as const;

export type FolderTag = (typeof FOLDER_TAGS)[number];

export const FOLDER_TAG_LABELS: Record<FolderTag, string> = {
    'album-pages': 'Album pages',
    documents: 'Documents',
    videos: 'Videos',
    ignore: 'Ignore',
};

export interface AdminFolder {
    slug: string;
    displayName: string;
    sharingUrl: string;
    folderPath: string;
    sortOrder: number;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

export interface FolderInput {
    slug: string;
    displayName: string;
    sharingUrl: string;
    folderPath: string;
    sortOrder: number;
    tags: string[];
}

export interface FolderExport {
    version: number;
    exportedAt: string;
    folders: AdminFolder[];
}

export interface ImportResponse {
    mode: 'upsert' | 'replace';
    created: number;
    updated: number;
}
