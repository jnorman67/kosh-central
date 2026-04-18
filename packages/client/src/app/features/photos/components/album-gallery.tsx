import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import type { Photo, PhotoFolder } from '@/app/features/photos/models/photos.models';

interface AlbumGalleryProps {
    folders: PhotoFolder[];
    onSelect: (index: number) => void;
}

function pickCover(photos: Photo[] | undefined, preferredFileName: string | undefined): Photo | null {
    if (!photos) return null;
    if (preferredFileName) {
        const chosen = photos.find((p) => p.name === preferredFileName);
        if (chosen) return chosen;
        // Configured cover not found (renamed/deleted) — fall through to default.
    }
    return photos.find((p) => !p.relations?.some((r) => r.relationType === 'back-of')) ?? null;
}

export function AlbumGallery({ folders, onSelect }: AlbumGalleryProps) {
    const { useGetPhotosForFolders } = usePhotosQueries();
    const results = useGetPhotosForFolders(folders.map((f) => f.id));

    if (folders.length === 0) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">No albums</div>;
    }

    return (
        <div className="h-full overflow-auto bg-black p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {folders.map((folder, i) => {
                    const q = results[i];
                    const cover = pickCover(q?.data, folder.coverFileName);
                    const coverSrc = cover?.thumbnailUrl ?? cover?.downloadUrl;
                    const count = q?.data?.length ?? 0;
                    return (
                        <button
                            key={folder.id}
                            type="button"
                            onClick={() => onSelect(i)}
                            className="group relative aspect-[4/3] overflow-hidden rounded-md bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
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
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
