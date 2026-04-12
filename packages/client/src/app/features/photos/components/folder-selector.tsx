import type { PhotoFolder } from '@/app/features/photos/models/photos.models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FolderSelectorProps {
    folders: PhotoFolder[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    isLoading: boolean;
}

export function FolderSelector({ folders, selectedIndex, onSelect, isLoading }: FolderSelectorProps) {
    if (isLoading) {
        return <div className="flex items-center px-4 py-2 text-sm text-muted-foreground">Loading folders...</div>;
    }

    if (folders.length === 0) {
        return <div className="flex items-center px-4 py-2 text-sm text-muted-foreground">No folders configured</div>;
    }

    return (
        <div className="flex items-center gap-3 px-4 py-2">
            <span className="text-sm font-medium">Folder</span>
            <Select value={String(selectedIndex)} onValueChange={(val) => onSelect(Number(val))}>
                <SelectTrigger className="w-[240px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {folders.map((folder, i) => (
                        <SelectItem key={folder.id} value={String(i)}>
                            {folder.displayName}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
