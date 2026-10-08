import { GalleryFormDialog } from '@/app/features/galleries/components/gallery-form-dialog';
import { useGalleriesQueries } from '@/app/features/galleries/contexts/galleries-query.context';
import { AlbumTile, formatAlbumContents } from '@/app/features/photos/components/album-tile';
import { ALBUMS_PLACE, getPlace, peopleGalleryPlace } from '@/app/features/photos/lib/places';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

interface GalleriesSectionProps {
    onSelect: (galleryId: string) => void;
}

/** The user's people galleries, above the album list, with a way to make a new one. */
export function GalleriesSection({ onSelect }: GalleriesSectionProps) {
    const { useGetGalleries, useGetGalleryCovers, useCreateGallery } = useGalleriesQueries();
    const { data: galleries = [], isLoading } = useGetGalleries();
    const { data: covers, isLoading: coversLoading } = useGetGalleryCovers();
    const createGallery = useCreateGallery();
    const [creating, setCreating] = useState(false);

    const byId = useMemo(() => new Map((covers ?? []).map((c) => [c.galleryId, c])), [covers]);
    // The album list's place memory scrolls to the last-opened tile; this highlights it.
    const focus = useMemo(() => getPlace(ALBUMS_PLACE).focus ?? null, []);

    if (isLoading) return null;

    return (
        <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-zinc-400">My galleries</h2>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreating(true)}
                    className="text-zinc-300 hover:bg-white/10 hover:text-white"
                >
                    <Plus className="h-4 w-4" />
                    New gallery
                </Button>
            </div>
            {galleries.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                    {galleries.map((gallery) => {
                        const info = byId.get(gallery.id);
                        return (
                            <AlbumTile
                                key={gallery.id}
                                title={gallery.name}
                                coverUrl={info?.coverUrl}
                                subtitle={info ? formatAlbumContents(0, info.photoCount) || 'No photos yet' : undefined}
                                isLoading={coversLoading}
                                placeItem={peopleGalleryPlace(gallery.id)}
                                highlighted={focus === peopleGalleryPlace(gallery.id)}
                                onClick={() => onSelect(gallery.id)}
                            />
                        );
                    })}
                </div>
            ) : (
                <p className="text-sm text-zinc-500">Make a gallery of every photo of one or more people, gathered from all the albums.</p>
            )}
            <GalleryFormDialog
                open={creating}
                onOpenChange={setCreating}
                onSubmit={async (input) => {
                    const gallery = await createGallery.mutateAsync(input);
                    onSelect(gallery.id);
                }}
            />
        </section>
    );
}
