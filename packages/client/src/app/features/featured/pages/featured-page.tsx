import { FeaturedDisplay } from '@/app/features/featured/components/featured-display';
import { useFeaturedQueries } from '@/app/features/featured/contexts/featured-query.context';
import { hideSplash } from '@/lib/splash';
import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

/** Landing page shown right after sign-in while an admin has an album featured. Falls through to
 *  the viewer when nothing is featured, so the login page can always route here. */
export function FeaturedPage() {
    const navigate = useNavigate();
    const { useGetFeatured } = useFeaturedQueries();
    const { data: featured, isLoading, isError } = useGetFeatured();

    useEffect(() => {
        if (!isLoading) hideSplash();
    }, [isLoading]);

    if (isLoading) return null;
    if (isError || !featured?.enabled) return <Navigate to="/" replace />;

    const albumUrl = `/?folder=${encodeURIComponent(featured.folderId)}`;
    const photos = featured.photos;

    return (
        <FeaturedDisplay
            content={featured}
            images={photos.map((p) => ({ url: p.imageUrl, alt: featured.title || featured.folderDisplayName }))}
            onOpenPhoto={(i) => navigate(`${albumUrl}&photo=${encodeURIComponent(photos[i].photoKey)}`)}
            onViewAlbum={() => navigate(albumUrl)}
            onContinue={() => navigate('/')}
        />
    );
}
