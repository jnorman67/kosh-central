export interface AdminFolder {
    slug: string;
    displayName: string;
    sharingUrl: string;
    folderPath: string;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface FolderInput {
    slug: string;
    displayName: string;
    sharingUrl: string;
    folderPath: string;
    sortOrder: number;
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
