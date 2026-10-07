import type { Photo } from '@/app/features/photos/models/photos.models';
import { Fragment } from 'react';

interface PhotoGalleryProps {
    photos: Photo[];
    isLoading: boolean;
    onSelect: (index: number) => void;
    /** A heading inserted before the photo at `start`, e.g. where a featured album's own photos end. */
    section?: { start: number; label: string };
}

export function PhotoGallery({ photos, isLoading, onSelect, section }: PhotoGalleryProps) {
    if (isLoading) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">Loading...</div>;
    }

    if (photos.length === 0) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">No photos</div>;
    }

    return (
        <div className="h-full overflow-auto bg-black p-2 sm:p-4">
            <div className="grid grid-cols-2 gap-1 sm:gap-2 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                {photos.map((p, i) => (
                    <Fragment key={p.id}>
                        {i === section?.start && (
                            <h2 className="col-span-full px-1 pb-1 pt-6 text-sm font-medium text-zinc-400">{section.label}</h2>
                        )}
                        <button
                            type="button"
                            onClick={() => onSelect(i)}
                            className="group relative aspect-square overflow-hidden rounded-sm bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-white"
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
