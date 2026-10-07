import { cn } from '@/lib/utils';

function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** e.g. "3 folders · 412 photos". Empty when there is nothing to count. */
export function formatAlbumContents(subfolderCount: number, photoCount: number): string {
    const parts: string[] = [];
    if (subfolderCount > 0) parts.push(plural(subfolderCount, 'folder'));
    if (photoCount > 0) parts.push(plural(photoCount, 'photo'));
    return parts.join(' · ');
}

interface AlbumTileProps {
    title: string;
    coverUrl: string | null | undefined;
    /** Shown under the title, e.g. the album's folder and photo counts. */
    subtitle?: string;
    isNew?: boolean;
    isLoading?: boolean;
    /** Identifies the tile to the scroll container's place memory. */
    placeItem?: string;
    /** Marks the album or subfolder the user last opened, so they can find their place again. */
    highlighted?: boolean;
    onClick: () => void;
}

/** A cover photo drawn as the top of a small stack of prints, for albums and the subfolders within them. */
export function AlbumTile({ title, coverUrl, subtitle, isNew, isLoading, placeItem, highlighted, onClick }: AlbumTileProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            data-place-item={placeItem}
            className="group relative aspect-[4/3] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white"
        >
            <div
                aria-hidden="true"
                className="absolute inset-0 translate-x-[6px] translate-y-[6px] rotate-[3deg] rounded-md bg-zinc-700 shadow-md ring-1 ring-black/40"
            />
            <div
                aria-hidden="true"
                className="absolute inset-0 -translate-x-[5px] translate-y-[3px] -rotate-[2deg] rounded-md bg-zinc-800 shadow-md ring-1 ring-black/40"
            />
            <div
                className={cn(
                    'relative h-full w-full overflow-hidden rounded-md bg-zinc-900 shadow-lg ring-1 ring-white/15',
                    highlighted && 'ring-[3px] ring-amber-400',
                )}
            >
                {coverUrl ? (
                    <img
                        src={coverUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-opacity group-hover:opacity-60"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
                        {isLoading ? 'Loading…' : 'No preview'}
                    </div>
                )}
                {isNew && (
                    <span className="absolute right-2 top-2 rounded bg-[hsl(var(--brand))] px-1.5 py-0.5 text-xs font-semibold text-[hsl(var(--brand-foreground))] shadow">
                        New
                    </span>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-left">
                    <div className="truncate text-sm font-medium text-white">{title}</div>
                    {subtitle && <div className="text-xs text-zinc-300">{subtitle}</div>}
                </div>
            </div>
        </button>
    );
}
