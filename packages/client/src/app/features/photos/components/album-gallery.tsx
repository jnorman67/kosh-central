import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import type { PhotoFolder } from '@/app/features/photos/models/photos.models';
import { useMemo } from 'react';

const NEW_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

function isNewAlbum(folder: PhotoFolder): boolean {
    return Date.now() - new Date(folder.createdAt).getTime() < NEW_THRESHOLD_MS;
}

interface AlbumGalleryProps {
    folders: PhotoFolder[];
    onSelect: (id: string) => void;
}

export function AlbumGallery({ folders, onSelect }: AlbumGalleryProps) {
    const { useGetFolderCovers } = usePhotosQueries();
    const { data: covers, isLoading } = useGetFolderCovers();

    const byId = useMemo(() => new Map((covers ?? []).map((c) => [c.folderId, c])), [covers]);

    if (folders.length === 0) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">No albums</div>;
    }

    return (
        <div className="h-full overflow-auto bg-black p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                {folders.map((folder) => {
                    const info = byId.get(folder.id);
                    const coverSrc = info?.coverUrl ?? undefined;
                    const count = info?.photoCount ?? 0;
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
                                        {isLoading ? 'Loading…' : 'No preview'}
                                    </div>
                                )}
                                {isNewAlbum(folder) && (
                                    <span className="absolute right-2 top-2 rounded bg-[hsl(var(--brand))] px-1.5 py-0.5 text-xs font-semibold text-[hsl(var(--brand-foreground))] shadow">
                                        New
                                    </span>
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
