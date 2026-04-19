import type { AdminFolder, ApiError, FolderExport, FolderInput, ImportResponse } from '@/app/features/admin/models/folder.models';

/** Thrown when the server rejects a request — preserves the `field` for form-level display. */
export class AdminFoldersError extends Error {
    constructor(
        message: string,
        public status: number,
        public field?: string,
    ) {
        super(message);
        this.name = 'AdminFoldersError';
    }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
    if (res.ok) return (await res.json()) as T;
    let body: ApiError | undefined;
    try {
        body = (await res.json()) as ApiError;
    } catch {
        /* ignore */
    }
    throw new AdminFoldersError(body?.error ?? `Request failed (${res.status})`, res.status, body?.field);
}

export class AdminFoldersService {
    async list(): Promise<AdminFolder[]> {
        const res = await fetch('/api/admin/folders');
        return parseOrThrow<AdminFolder[]>(res);
    }

    async create(input: FolderInput): Promise<AdminFolder> {
        const res = await fetch('/api/admin/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        return parseOrThrow<AdminFolder>(res);
    }

    async update(slug: string, input: FolderInput): Promise<AdminFolder> {
        const res = await fetch(`/api/admin/folders/${encodeURIComponent(slug)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        return parseOrThrow<AdminFolder>(res);
    }

    async remove(slug: string): Promise<void> {
        const res = await fetch(`/api/admin/folders/${encodeURIComponent(slug)}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) {
            await parseOrThrow(res);
        }
    }

    async importFolders(folders: FolderInput[], mode: 'upsert' | 'replace'): Promise<ImportResponse> {
        const res = await fetch('/api/admin/folders/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folders, mode }),
        });
        return parseOrThrow<ImportResponse>(res);
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
