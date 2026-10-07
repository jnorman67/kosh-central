import { AlbumTile, formatAlbumContents } from '@/app/features/photos/components/album-tile';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { usePlaceMemory } from '@/app/features/photos/hooks/use-place-memory';
import type { PhotoFolder } from '@/app/features/photos/models/photos.models';
import { useMemo, type ReactNode } from 'react';

const NEW_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

function isNewAlbum(folder: PhotoFolder): boolean {
    return Date.now() - new Date(folder.createdAt).getTime() < NEW_THRESHOLD_MS;
}

interface AlbumGalleryProps {
    folders: PhotoFolder[];
    onSelect: (id: string) => void;
    /** Where the album list's scroll position and last-opened album are remembered. */
    placeKey: string;
    /** Shown above the grid and scrolled with it, e.g. a link to the featured album. */
    leading?: ReactNode;
}

export function AlbumGallery({ folders, onSelect, placeKey, leading }: AlbumGalleryProps) {
    const { useGetFolderCovers } = usePhotosQueries();
    const { data: covers, isLoading } = useGetFolderCovers();

    const byId = useMemo(() => new Map((covers ?? []).map((c) => [c.folderId, c])), [covers]);
    const { ref, focus } = usePlaceMemory<HTMLDivElement>(placeKey, folders.length > 0);

    if (folders.length === 0) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">No albums</div>;
    }

    return (
        <div ref={ref} className="h-full overflow-auto bg-black p-4 sm:p-6">
            {leading}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                {folders.map((folder) => {
                    const info = byId.get(folder.id);
                    return (
                        <AlbumTile
                            key={folder.id}
                            title={folder.displayName}
                            coverUrl={info?.coverUrl}
                            subtitle={formatAlbumContents(info?.subfolderCount ?? 0, info?.photoCount ?? 0)}
                            isNew={isNewAlbum(folder)}
                            isLoading={isLoading}
                            placeItem={folder.id}
                            highlighted={focus === folder.id}
                            onClick={() => onSelect(folder.id)}
                        />
                    );
                })}
            </div>
        </div>
    );
}
