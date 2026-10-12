import type { PhotoFolder } from '@/app/features/photos/models/photos.models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const NEW_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

function isNewAlbum(folder: PhotoFolder): boolean {
    return Date.now() - new Date(folder.createdAt).getTime() < NEW_THRESHOLD_MS;
}

interface FolderSelectorProps {
    folders: PhotoFolder[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    isLoading: boolean;
    /** On phones, shrink the album name to a one-line caption, e.g. above the subfolder being viewed. */
    caption?: boolean;
}

// On phones the album name is the page title: it takes the header's free width and wraps to a
// second line instead of truncating inside a box. Wider screens get a conventional select.
export function FolderSelector({ folders, selectedId, onSelect, isLoading, caption = false }: FolderSelectorProps) {
    if (isLoading) {
        return <div className="flex items-center px-2 py-2 text-sm text-muted-foreground sm:px-4">Loading albums...</div>;
    }

    if (folders.length === 0) {
        return <div className="flex items-center px-2 py-2 text-sm text-muted-foreground sm:px-4">No albums configured</div>;
    }

    const selected = folders.find((f) => f.id === selectedId);

    return (
        <div className="flex min-w-0 max-w-full items-center gap-3 sm:px-4 sm:py-2">
            <span className="hidden text-sm font-medium lg:inline">Album</span>
            <Select value={selectedId ?? undefined} onValueChange={onSelect}>
                <SelectTrigger
                    aria-label="Album"
                    className={cn(
                        // Ring for keyboard focus only: after a tap, focus returns here and would box the title.
                        'h-auto w-auto min-w-0 max-w-full justify-start gap-1 whitespace-normal border-0 bg-transparent px-1 text-left shadow-none focus:ring-0 focus-visible:ring-1 [&>svg]:shrink-0',
                        caption
                            ? 'py-0.5 text-xs font-medium text-muted-foreground [&>span]:line-clamp-1'
                            : 'py-1 text-[15px] font-semibold leading-tight text-amber-950 [&>span]:line-clamp-2',
                        // The select may narrow, but never push the header's buttons off the edge.
                        'sm:h-9 sm:w-[360px] sm:justify-between sm:whitespace-nowrap sm:border sm:border-input sm:bg-transparent sm:px-3 sm:py-2 sm:text-sm sm:font-normal sm:leading-normal sm:text-foreground sm:shadow-sm sm:[&>span]:line-clamp-1',
                    )}
                >
                    {/* Just the name: the list's "New" badges would crowd it out of a narrow trigger. */}
                    <SelectValue>{selected?.displayName}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-1rem)]">
                    {folders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id} className="py-2.5 sm:py-1.5 [&>span]:min-w-0">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate">{folder.displayName}</span>
                                {isNewAlbum(folder) && (
                                    <span className="shrink-0 rounded bg-[hsl(var(--brand))] px-1.5 py-0.5 text-xs font-semibold text-[hsl(var(--brand-foreground))]">
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
