import type { AdminFolder, FolderExport, FolderInput, ImportResponse } from '@/app/features/admin/models/folder.models';
import { apiFetch } from '@/lib/api-client';

export class AdminFoldersService {
    async list(): Promise<AdminFolder[]> {
        return apiFetch<AdminFolder[]>('/api/admin/folders');
    }

    async create(input: FolderInput): Promise<AdminFolder> {
        return apiFetch<AdminFolder>('/api/admin/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
    }

    async update(slug: string, input: FolderInput): Promise<AdminFolder> {
        return apiFetch<AdminFolder>(`/api/admin/folders/${encodeURIComponent(slug)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
    }

    async remove(slug: string): Promise<void> {
        await apiFetch<void>(`/api/admin/folders/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    }

    async reorder(slugs: string[]): Promise<AdminFolder[]> {
        return apiFetch<AdminFolder[]>('/api/admin/folders/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slugs }),
        });
    }

    async importFolders(folders: FolderInput[], mode: 'upsert' | 'replace'): Promise<ImportResponse> {
        return apiFetch<ImportResponse>('/api/admin/folders/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folders, mode }),
        });
    }

    /** Returns the export URL so the browser can download it directly. */
    exportUrl(): string {
        return '/api/admin/folders/export';
    }

    /** Parse an uploaded JSON file, accepting either the export envelope or a bare array. */
    static parseImportFile(text: string): FolderInput[] {
        const parsed: unknown = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : (parsed as FolderExport).folders;
        if (!Array.isArray(list)) throw new Error('JSON must be a folder export object or a folder array');
        return list.map((entry, i) => {
            if (!entry || typeof entry !== 'object') throw new Error(`folders[${i}]: expected object`);
            const e = entry as Record<string, unknown>;
            return {
                slug: String(e.slug ?? ''),
                displayName: String(e.displayName ?? ''),
                sharingUrl: String(e.sharingUrl ?? ''),
                folderPath: String(e.folderPath ?? ''),
                sortOrder: typeof e.sortOrder === 'number' ? e.sortOrder : 0,
            };
        });
    }
}
