import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { LetterboxViewer } from '@/app/features/photos/components/letterbox-viewer';
import { PhotoControls } from '@/app/features/photos/components/photo-controls';
import { PhotoGallery } from '@/app/features/photos/components/photo-gallery';
import { StarRating } from '@/app/features/photos/components/star-rating';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, LayoutGrid, LibraryBig } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PAGE_SIZE = 24;

export function FavoritesPage() {
    const navigate = useNavigate();
    const { useGetFavorites, useRatePhoto } = usePhotosQueries();
    const { useGetMe, useLogout } = useAuthQueries();
    const ratePhoto = useRatePhoto();
    const { data: me } = useGetMe();
    const logout = useLogout();

    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
    const offset = page * PAGE_SIZE;

    const [photoIndex, setPhotoIndex] = useState<number | null>(null);

    const { data, isLoading } = useGetFavorites(offset, PAGE_SIZE);
    const photos = data?.photos ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // If the page becomes empty because the underlying list shrunk (e.g. user cleared
    // ratings), step back to the previous page.
    useEffect(() => {
        if (!data) return;
        if (photos.length === 0 && page > 0) {
            setSearchParams({ page: String(page - 1) }, { replace: true });
        }
    }, [data, photos.length, page, setSearchParams]);

    // Reset the single-photo view when the page of photos changes.
    useEffect(() => {
        setPhotoIndex(null);
    }, [page]);

    // Clamp the current index if the page shrinks under our feet (rating changes).
    useEffect(() => {
        if (photoIndex === null) return;
        if (photos.length === 0) setPhotoIndex(null);
        else if (photoIndex >= photos.length) setPhotoIndex(photos.length - 1);
    }, [photos.length, photoIndex]);

    const currentPhoto = photoIndex !== null ? (photos[photoIndex] ?? null) : null;
    const isPhoto = currentPhoto !== null;

    const goNext = useCallback(() => {
        if (photos.length === 0) return;
        setPhotoIndex((i) => (i === null ? 0 : (i + 1) % photos.length));
    }, [photos.length]);

    const goPrev = useCallback(() => {
        if (photos.length === 0) return;
        setPhotoIndex((i) => (i === null ? 0 : (i - 1 + photos.length) % photos.length));
    }, [photos.length]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape' && isPhoto) setPhotoIndex(null);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isPhoto]);

    function setPage(next: number) {
        setSearchParams({ page: String(next) });
    }

    function handleLogout() {
        logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
    }

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + photos.length, total);

    return (
        <>
            {isPhoto &&
                photos
                    .slice((photoIndex ?? 0) + 1, (photoIndex ?? 0) + 3)
                    .map((p) => <link key={p.id} rel="preload" as="image" href={p.downloadUrl} />)}

            <ViewerLayout
                header={
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/')}
                                title="Browse albums"
                                aria-label="Browse albums"
                            >
                                <LibraryBig className="h-4 w-4" />
                            </Button>
                            <div className="px-2 py-2 text-sm font-medium">My favorites</div>
                        </div>
                        <div className="flex items-center gap-3 px-4">
                            {isPhoto && (
                                <Button variant="ghost" size="sm" onClick={() => setPhotoIndex(null)}>
                                    <LayoutGrid className="mr-2 h-4 w-4" />
                                    Gallery
                                </Button>
                            )}
                            <span className="text-sm text-muted-foreground">{me?.displayName}</span>
                            <Button variant="ghost" size="sm" onClick={handleLogout}>
                                Sign out
                            </Button>
                        </div>
                    </div>
                }
                viewer={
                    isPhoto ? (
                        <LetterboxViewer photo={currentPhoto} isLoading={false} />
                    ) : (
                        <PhotoGallery photos={photos} isLoading={isLoading} onSelect={(i) => setPhotoIndex(i)} />
                    )
                }
                toolbar={
                    isPhoto ? (
                        <div className="flex items-center justify-center gap-6 px-4 py-2">
                            <PhotoControls currentIndex={photoIndex ?? 0} totalCount={photos.length} onPrev={goPrev} onNext={goNext} />
                            {currentPhoto && (
                                <span className="max-w-[40ch] truncate text-sm text-muted-foreground" title={currentPhoto.name}>
                                    {currentPhoto.folderDisplayName} · {currentPhoto.name}
                                </span>
                            )}
                            {currentPhoto?.catalogId && (
                                <StarRating
                                    rating={currentPhoto.rating}
                                    disabled={ratePhoto.isPending}
                                    onChange={(rating) =>
                                        ratePhoto.mutate({
                                            catalogId: currentPhoto.catalogId!,
                                            folderId: currentPhoto.folderId,
                                            rating,
                                        })
                                    }
                                />
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-4 px-4 py-2 text-sm text-muted-foreground">
                            <Button variant="ghost" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0}>
                                <ChevronLeft className="mr-1 h-4 w-4" />
                                Prev
                            </Button>
                            <span className="min-w-[12rem] text-center">
                                {total === 0 ? 'No favorites yet' : `${from}–${to} of ${total} · Page ${page + 1} of ${totalPages}`}
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => setPage(page + 1)} disabled={page + 1 >= totalPages}>
                                Next
                                <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                        </div>
                    )
                }
            />
        </>
    );
}
