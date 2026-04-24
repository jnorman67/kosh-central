import type { PhotoFolder } from '@/app/features/photos/models/photos.models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NEW_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

function isNewAlbum(folder: PhotoFolder): boolean {
    return Date.now() - new Date(folder.createdAt).getTime() < NEW_THRESHOLD_MS;
}

interface FolderSelectorProps {
    folders: PhotoFolder[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    isLoading: boolean;
}

export function FolderSelector({ folders, selectedId, onSelect, isLoading }: FolderSelectorProps) {
    if (isLoading) {
        return <div className="flex items-center px-2 py-2 text-sm text-muted-foreground sm:px-4">Loading albums...</div>;
    }

    if (folders.length === 0) {
        return <div className="flex items-center px-2 py-2 text-sm text-muted-foreground sm:px-4">No albums configured</div>;
    }

    return (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 sm:flex-none sm:px-4">
            <span className="hidden text-sm font-medium sm:inline">Album</span>
            <Select value={selectedId ?? undefined} onValueChange={onSelect}>
                <SelectTrigger className="min-w-0 flex-1 sm:w-[240px] sm:flex-none">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {folders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                            <span className="flex items-center gap-2">
                                {folder.displayName}
                                {isNewAlbum(folder) && (
                                    <span className="rounded bg-[hsl(var(--brand))] px-1.5 py-0.5 text-xs font-semibold text-[hsl(var(--brand-foreground))]">
                                        New
                                    </span>
                                )}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
