import type { PhotoFolder } from '@/app/features/photos/models/photos.models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FolderSelectorProps {
    folders: PhotoFolder[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    isLoading: boolean;
}

export function FolderSelector({ folders, selectedId, onSelect, isLoading }: FolderSelectorProps) {
    if (isLoading) {
        return <div className="flex items-center px-4 py-2 text-sm text-muted-foreground">Loading albums...</div>;
    }

    if (folders.length === 0) {
        return <div className="flex items-center px-4 py-2 text-sm text-muted-foreground">No albums configured</div>;
    }

    return (
        <div className="flex items-center gap-3 px-4 py-2">
            <span className="text-sm font-medium">Album</span>
            <Select value={selectedId ?? undefined} onValueChange={onSelect}>
                <SelectTrigger className="w-[240px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {folders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                            {folder.displayName}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
