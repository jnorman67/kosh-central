import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import type { Photo, PhotoFolder } from '@/app/features/photos/models/photos.models';

interface AlbumGalleryProps {
    folders: PhotoFolder[];
    onSelect: (id: string) => void;
}

function pickCover(photos: Photo[] | undefined, preferredFileName: string | undefined): Photo | null {
    if (!photos) return null;
    if (preferredFileName) {
        const chosen = photos.find((p) => p.name === preferredFileName);
        if (chosen) return chosen;
        // Configured cover not found (renamed/deleted) — fall through to default.
    }
    // Default cover is the first preferred-front in the folder; uncataloged
    // photos without bundle info are treated as preferred fronts.
    return (
        photos.find((p) => {
            if (!p.catalogId || !p.bundleId) return true;
            return p.side === 'front' && !!p.isPreferred;
        }) ?? null
    );
}

export function AlbumGallery({ folders, onSelect }: AlbumGalleryProps) {
    const { useGetPhotosForFolders } = usePhotosQueries();
    const results = useGetPhotosForFolders(folders.map((f) => f.id));

    if (folders.length === 0) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">No albums</div>;
    }

    return (
        <div className="h-full overflow-auto bg-black p-6">
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {folders.map((folder, i) => {
                    const q = results[i];
                    const cover = pickCover(q?.data, folder.coverFileName);
                    const coverSrc = cover?.thumbnailUrl ?? cover?.downloadUrl;
                    const count = q?.data?.length ?? 0;
                    return (
                        <button
                            key={folder.id}
                            type="button"
                            onClick={() => onSelect(folder.id)}
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
                            <div className="relative h-full w-full overflow-hidden rounded-md bg-zinc-900 shadow-lg ring-1 ring-white/15">
                                {coverSrc ? (
                                    <img
                                        src={coverSrc}
                                        alt=""
                                        loading="lazy"
                                        className="h-full w-full object-cover transition-opacity group-hover:opacity-60"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
                                        {q?.isLoading ? 'Loading…' : 'No preview'}
                                    </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-left">
                                    <div className="truncate text-sm font-medium text-white">{folder.displayName}</div>
                                    {count > 0 && <div className="text-xs text-zinc-300">{count} photos</div>}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
