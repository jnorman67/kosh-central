import type { Photo } from '@/app/features/photos/models/photos.models';

interface PhotoGalleryProps {
    photos: Photo[];
    isLoading: boolean;
    onSelect: (index: number) => void;
}

export function PhotoGallery({ photos, isLoading, onSelect }: PhotoGalleryProps) {
    if (isLoading) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">Loading...</div>;
    }

    if (photos.length === 0) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">No photos</div>;
    }

    return (
        <div className="h-full overflow-auto bg-black p-4">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {photos.map((p, i) => (
                    <button
                        key={p.id}
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
                ))}
            </div>
        </div>
    );
}
