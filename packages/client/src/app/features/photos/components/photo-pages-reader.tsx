import { FileThumbnail } from '@/app/features/photos/components/file-thumbnail';
import { usePlaceMemory } from '@/app/features/photos/hooks/use-place-memory';
import { photoKey } from '@/app/features/photos/hooks/use-viewer-state';
import { isImageFile } from '@/app/features/photos/lib/files';
import type { Photo } from '@/app/features/photos/models/photos.models';
import { cn } from '@/lib/utils';

interface PhotoPagesReaderProps {
    photos: Photo[];
    isLoading: boolean;
    onSelect: (index: number) => void;
    /** Where the reader's scroll position and last-opened page are remembered. */
    placeKey: string;
}

export function PhotoPagesReader({ photos, isLoading, onSelect, placeKey }: PhotoPagesReaderProps) {
    const { ref, focus } = usePlaceMemory<HTMLDivElement>(placeKey, !isLoading && photos.length > 0);

    if (isLoading) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">Loading...</div>;
    }

    if (photos.length === 0) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">No pages</div>;
    }

    return (
        <div ref={ref} className="h-full overflow-auto bg-black">
            <div className="mx-auto flex max-w-4xl flex-col gap-4 p-2 sm:gap-6 sm:p-6">
                {photos.map((p, i) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelect(i)}
                        data-place-item={photoKey(p)}
                        className={cn(
                            'group relative block overflow-hidden rounded-sm bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-white',
                            focus === photoKey(p) && 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-black',
                        )}
                        aria-label={`Open page ${i + 1}`}
                    >
                        {isImageFile(p) ? (
                            <img
                                src={p.downloadUrl}
                                alt={`Page ${i + 1}`}
                                loading="lazy"
                                className="block h-auto w-full object-contain transition-opacity group-hover:opacity-90"
                            />
                        ) : (
                            // A document page opens in the viewer; here it is its preview, at a fixed shape.
                            <div className="aspect-[4/3] w-full">
                                <FileThumbnail
                                    file={p}
                                    imgClassName="h-full w-full object-contain transition-opacity group-hover:opacity-90"
                                />
                            </div>
                        )}
                        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Page {i + 1}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
