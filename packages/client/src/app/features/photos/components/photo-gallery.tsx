import { AlbumTile, formatAlbumContents } from '@/app/features/photos/components/album-tile';
import { usePlaceMemory } from '@/app/features/photos/hooks/use-place-memory';
import { photoKey } from '@/app/features/photos/hooks/use-viewer-state';
import { subfolderFocus } from '@/app/features/photos/lib/places';
import type { Photo, Subfolder } from '@/app/features/photos/models/photos.models';
import { cn } from '@/lib/utils';
import { Fragment } from 'react';

interface PhotoGalleryProps {
    photos: Photo[];
    isLoading: boolean;
    onSelect: (index: number) => void;
    /** Where this gallery's scroll position and last-opened item are remembered. */
    placeKey: string;
    /** A heading inserted before the photo at `start`, e.g. where a featured album's own photos end. */
    section?: { start: number; label: string };
    /** Subfolders of a browse album, shown as tiles ahead of the photos. */
    subfolders?: Subfolder[];
    onSelectSubfolder?: (path: string) => void;
}

export function PhotoGallery({ photos, isLoading, onSelect, placeKey, section, subfolders = [], onSelectSubfolder }: PhotoGalleryProps) {
    const isEmpty = photos.length === 0 && subfolders.length === 0;
    const { ref, focus } = usePlaceMemory<HTMLDivElement>(placeKey, !isLoading && !isEmpty);

    if (isLoading) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">Loading...</div>;
    }

    if (isEmpty) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">No photos</div>;
    }

    return (
        <div ref={ref} className="h-full overflow-auto bg-black p-2 sm:p-4">
            {subfolders.length > 0 && (
                <div className="grid grid-cols-2 gap-4 px-2 pb-6 pt-2 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] sm:gap-6">
                    {subfolders.map((sub) => (
                        <AlbumTile
                            key={sub.path}
                            title={sub.name}
                            coverUrl={sub.coverUrl}
                            subtitle={formatAlbumContents(sub.subfolderCount, sub.photoCount)}
                            placeItem={subfolderFocus(sub.path)}
                            highlighted={focus === subfolderFocus(sub.path)}
                            onClick={() => onSelectSubfolder?.(sub.path)}
                        />
                    ))}
                </div>
            )}
            <div className="grid grid-cols-2 gap-1 sm:gap-2 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                {photos.map((p, i) => (
                    <Fragment key={p.id}>
                        {i === section?.start && (
                            <h2 className="col-span-full px-1 pb-1 pt-6 text-sm font-medium text-zinc-400">{section.label}</h2>
                        )}
                        <button
                            type="button"
                            onClick={() => onSelect(i)}
                            data-place-item={photoKey(p)}
                            className={cn(
                                'group relative aspect-square overflow-hidden rounded-sm bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-white',
                                focus === photoKey(p) && 'z-10 ring-[3px] ring-amber-400 ring-offset-2 ring-offset-black',
                            )}
                        >
                            <img
                                src={p.thumbnailUrl ?? p.downloadUrl}
                                alt={p.name}
                                loading="lazy"
                                className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                            />
                        </button>
                    </Fragment>
                ))}
            </div>
        </div>
    );
}
