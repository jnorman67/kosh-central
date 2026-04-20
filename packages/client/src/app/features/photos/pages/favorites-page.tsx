import { PhotoGallery } from '@/app/features/photos/components/photo-gallery';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { BrandMark } from '@/components/layout/brand-mark';
import { UserMenu } from '@/components/layout/user-menu';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Play } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PAGE_SIZE = 24;

export function FavoritesPage() {
    const navigate = useNavigate();
    const { useGetFavorites } = usePhotosQueries();

    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
    const offset = page * PAGE_SIZE;

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

    function setPage(next: number) {
        setSearchParams({ page: String(next) });
    }

    function openFavorite(index: number) {
        const photo = photos[index];
        if (!photo) return;
        const photoKey = photo.contentHash ?? photo.name;
        navigate(`/?folder=${encodeURIComponent(photo.folderId)}&photo=${encodeURIComponent(photoKey)}`);
    }

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + photos.length, total);

    return (
        <ViewerLayout
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BrandMark onClick={() => navigate('/')} title="Browse albums" />
                        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} title="Back to photos">
                            <ArrowLeft className="h-4 w-4" />
                            Back to photos
                        </Button>
                        <div className="flex items-center gap-2 px-2 py-2 text-sm font-medium">
                            <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                            My favorites
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/slideshow')}
                            disabled={total === 0}
                            title="Play slideshow"
                        >
                            <Play className="h-4 w-4" />
                            Play slideshow
                        </Button>
                        <UserMenu />
                    </div>
                </div>
            }
            viewer={<PhotoGallery photos={photos} isLoading={isLoading} onSelect={openFavorite} />}
            toolbar={
                <div className="flex items-center justify-center gap-4 px-4 py-2 text-sm text-muted-foreground">
                    <Button variant="ghost" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0}>
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                    </Button>
                    <span className="min-w-[12rem] text-center">
                        {total === 0 ? 'No favorites yet' : `${from}–${to} of ${total} · Page ${page + 1} of ${totalPages}`}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setPage(page + 1)} disabled={page + 1 >= totalPages}>
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            }
        />
    );
}
