import type { Photo } from '@/app/features/photos/models/photos.models';

interface PhotoPagesReaderProps {
    photos: Photo[];
    isLoading: boolean;
    onSelect: (index: number) => void;
}

export function PhotoPagesReader({ photos, isLoading, onSelect }: PhotoPagesReaderProps) {
    if (isLoading) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">Loading...</div>;
    }

    if (photos.length === 0) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">No pages</div>;
    }

    return (
        <div className="h-full overflow-auto bg-black">
            <div className="mx-auto flex max-w-4xl flex-col gap-4 p-2 sm:gap-6 sm:p-6">
                {photos.map((p, i) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelect(i)}
                        className="group relative block overflow-hidden rounded-sm bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-white"
                        aria-label={`Open page ${i + 1}`}
                    >
                        <img
                            src={p.downloadUrl}
                            alt={`Page ${i + 1}`}
                            loading="lazy"
                            className="block h-auto w-full object-contain transition-opacity group-hover:opacity-90"
                        />
                        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Page {i + 1}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
