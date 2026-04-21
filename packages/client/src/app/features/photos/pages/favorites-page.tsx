import { LetterboxViewer } from '@/app/features/photos/components/letterbox-viewer';
import { PhotoControls } from '@/app/features/photos/components/photo-controls';
import { PhotoGallery } from '@/app/features/photos/components/photo-gallery';
import { StarRating } from '@/app/features/photos/components/star-rating';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { BrandMark } from '@/components/layout/brand-mark';
import { UserMenu } from '@/components/layout/user-menu';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { hideSplash } from '@/lib/splash';
import { ArrowLeft, ExternalLink, Heart, LayoutGrid, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 50;
// While viewing a photo, fetch the next page when this close to the loaded end.
const PREFETCH_THRESHOLD = 5;

export function FavoritesPage() {
    const navigate = useNavigate();
    const { useGetFavoritesInfinite, useRatePhoto, useGetShareLink } = usePhotosQueries();
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useGetFavoritesInfinite(PAGE_SIZE);
    const ratePhoto = useRatePhoto();

    const photos = useMemo(() => data?.pages.flatMap((p) => p.photos) ?? [], [data]);
    const total = data?.pages[0]?.total ?? 0;

    const [view, setView] = useState<'gallery' | 'photo'>('gallery');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const current = photos[selectedIndex] ?? null;
    const { data: shareLink } = useGetShareLink(current?.folderId ?? null, current?.id ?? null);

    // If the favorites list shrinks (e.g. user cleared a rating in photo view) and
    // our index now points past the end, clamp or fall back to the gallery.
    useEffect(() => {
        if (view !== 'photo') return;
        if (photos.length === 0) {
            setView('gallery');
            setSelectedIndex(0);
        } else if (selectedIndex >= photos.length) {
            setSelectedIndex(photos.length - 1);
        }
    }, [view, photos.length, selectedIndex]);

    // Prefetch the next page as photo view approaches the end of the loaded list.
    useEffect(() => {
        if (view !== 'photo') return;
        if (!hasNextPage || isFetchingNextPage) return;
        if (photos.length > 0 && selectedIndex >= photos.length - PREFETCH_THRESHOLD) {
            void fetchNextPage();
        }
    }, [view, selectedIndex, photos.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Dismiss the initial splash once the first page of favorites has loaded.
    useEffect(() => {
        if (!isLoading) hideSplash();
    }, [isLoading]);

    function openFavorite(i: number) {
        setSelectedIndex(i);
        setView('photo');
    }

    const backToGallery = useCallback(() => setView('gallery'), []);

    const goNext = useCallback(() => {
        setSelectedIndex((i) => {
            if (photos.length === 0) return i;
            const next = i + 1;
            if (next < photos.length) return next;
            if (!hasNextPage) return 0;
            return i;
        });
    }, [photos.length, hasNextPage]);

    const goPrev = useCallback(() => {
        setSelectedIndex((i) => (i === 0 ? Math.max(0, photos.length - 1) : i - 1));
    }, [photos.length]);

    useEffect(() => {
        if (view !== 'photo') return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') backToGallery();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [view, backToGallery]);

    const isPhoto = view === 'photo';

    return (
        <ViewerLayout
            header={
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                        <BrandMark onClick={() => navigate('/')} title="Browse albums" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Back to photos">
                                    <ArrowLeft className="h-4 w-4" />
                                    <span className="hidden sm:inline">Back to photos</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Back to photos</TooltipContent>
                        </Tooltip>
                        <div className="flex items-center gap-2 px-1 py-2 text-sm font-medium sm:px-2">
                            <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                            <span className="hidden sm:inline">My favorites</span>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pr-1 sm:gap-3 sm:px-4">
                        {isPhoto && (
                            <Button variant="ghost" size="sm" onClick={backToGallery} aria-label="Back to gallery">
                                <LayoutGrid className="h-4 w-4" />
                                <span className="hidden sm:inline">Gallery</span>
                            </Button>
                        )}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate('/slideshow')}
                                    disabled={total === 0}
                                    aria-label="Play slideshow"
                                >
                                    <Play className="h-4 w-4" />
                                    <span className="hidden sm:inline">Play slideshow</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Play slideshow</TooltipContent>
                        </Tooltip>
                        <UserMenu />
                    </div>
                </div>
            }
            viewer={
                isPhoto ? (
                    <LetterboxViewer photo={current} isLoading={isLoading && !current} onSwipeNext={goNext} onSwipePrev={goPrev} />
                ) : (
                    <PhotoGallery photos={photos} isLoading={isLoading} onSelect={openFavorite} />
                )
            }
            toolbar={
                isPhoto ? (
                    <div className="flex items-center justify-between gap-2 px-2 py-2 sm:grid sm:grid-cols-3 sm:px-4">
                        <div className="hidden min-w-0 items-center justify-start gap-3 sm:flex">
                            {shareLink && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" asChild className="shrink-0">
                                            <a href={shareLink} target="_blank" rel="noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                                <span className="sr-only">Open in OneDrive</span>
                                            </a>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Open in OneDrive</TooltipContent>
                                </Tooltip>
                            )}
                            {current && (
                                <span className="truncate text-sm text-muted-foreground" title={current.name}>
                                    {current.name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center justify-center">
                            <PhotoControls currentIndex={selectedIndex} totalCount={photos.length} onPrev={goPrev} onNext={goNext} />
                        </div>
                        <div className="flex items-center justify-end">
                            {current?.catalogId && (
                                <StarRating
                                    rating={current.rating}
                                    disabled={ratePhoto.isPending}
                                    onChange={(rating) =>
                                        ratePhoto.mutate({
                                            catalogId: current.catalogId!,
                                            folderId: current.folderId,
                                            rating,
                                        })
                                    }
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-4 px-4 py-2 text-sm text-muted-foreground">
                        <span>
                            {total === 0
                                ? 'No favorites yet'
                                : photos.length < total
                                  ? `${photos.length} of ${total} loaded`
                                  : `${total} ${total === 1 ? 'favorite' : 'favorites'}`}
                        </span>
                        {hasNextPage && (
                            <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                                Load more
                            </Button>
                        )}
                    </div>
                )
            }
        />
    );
}
