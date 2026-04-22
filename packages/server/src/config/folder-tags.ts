// Controlled vocabulary for folder tags. Expand by adding a string here and
// updating the client-side list in packages/client/src/app/features/admin/models/folder.models.ts.
export const FOLDER_TAGS = ['album-pages', 'documents', 'videos'] as const;

export type FolderTag = (typeof FOLDER_TAGS)[number];

const TAG_SET: ReadonlySet<string> = new Set(FOLDER_TAGS);

export function isKnownFolderTag(value: string): value is FolderTag {
    return TAG_SET.has(value);
}
