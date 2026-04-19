import type { AdminFolder } from '@/app/features/admin/models/folder.models';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';

interface Props {
    folder: AdminFolder;
    onEdit: (folder: AdminFolder) => void;
    onDelete: (folder: AdminFolder) => void;
}

export function SortableFolderRow({ folder, onEdit, onDelete }: Props) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: folder.slug,
    });

    // Shift the row in sync with dnd-kit's measured movement.
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isDragging ? 'hsl(var(--muted))' : undefined,
        position: isDragging ? 'relative' : undefined,
        zIndex: isDragging ? 1 : undefined,
    };

    return (
        <TableRow ref={setNodeRef} style={style} data-dragging={isDragging}>
            <TableCell className="w-10 p-1">
                <button
                    type="button"
                    className="flex h-8 w-8 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
                    aria-label={`Drag to reorder ${folder.displayName}`}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
            </TableCell>
            <TableCell className="font-mono text-xs">{folder.slug}</TableCell>
            <TableCell>{folder.displayName}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{folder.folderPath}</TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(folder)} title="Edit">
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(folder)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}
