import { getDb } from './database.js';

interface FolderCoverRow {
    folder_path: string;
    file_name: string;
}

export function getFolderCover(folderPath: string): string | undefined {
    const row = getDb()
        .prepare('SELECT folder_path, file_name FROM folder_covers WHERE folder_path = ?')
        .get(folderPath) as FolderCoverRow | undefined;
    return row?.file_name;
}

export function getAllFolderCovers(): Map<string, string> {
    const rows = getDb().prepare('SELECT folder_path, file_name FROM folder_covers').all() as FolderCoverRow[];
    return new Map(rows.map((r) => [r.folder_path, r.file_name]));
}

export function setFolderCover(folderPath: string, fileName: string, userId: string): void {
    getDb()
        .prepare(
            `INSERT INTO folder_covers (folder_path, file_name, updated_at, updated_by)
             VALUES (?, ?, datetime('now'), ?)
             ON CONFLICT(folder_path) DO UPDATE SET
                 file_name = excluded.file_name,
                 updated_at = excluded.updated_at,
                 updated_by = excluded.updated_by`,
        )
        .run(folderPath, fileName, userId);
}

export function clearFolderCover(folderPath: string): void {
    getDb().prepare('DELETE FROM folder_covers WHERE folder_path = ?').run(folderPath);
}
