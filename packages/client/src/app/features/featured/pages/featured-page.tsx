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
    const photo = featured.photo;

    return (
        <FeaturedDisplay
            content={featured}
            imageUrl={photo?.imageUrl ?? null}
            imageAlt={featured.title || featured.folderDisplayName}
            onOpenPhoto={photo ? () => navigate(`${albumUrl}&photo=${encodeURIComponent(photo.photoKey)}`) : undefined}
            onViewAlbum={() => navigate(albumUrl)}
            onContinue={() => navigate('/')}
        />
    );
}
