import { FeaturedDisplay } from '@/app/features/featured/components/featured-display';
import { useFeaturedQueries } from '@/app/features/featured/contexts/featured-query.context';
import { viewerLocation } from '@/app/features/photos/lib/places';
import { hideSplash } from '@/lib/splash';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

/** Landing page shown right after sign-in while an admin has an album featured. Falls through to
 *  the viewer when nothing is featured, so the login page can always route here. */
export function FeaturedPage() {
    const navigate = useNavigate();
    const { useGetFeatured } = useFeaturedQueries();
    const { data: featured, isLoading, isError } = useGetFeatured();
    // A random rank per photo, fixed for this visit: each visit cycles through a different order,
    // but refetches (fresh download URLs) don't reshuffle the show midway.
    const [ranks] = useState(() => new Map<string, number>());
    const photos = useMemo(() => {
        if (!featured?.enabled) return [];
        const rankOf = (key: string) => {
            if (!ranks.has(key)) ranks.set(key, Math.random());
            return ranks.get(key)!;
        };
        // The featured photo still leads; everything after it is shuffled.
        const [lead, ...rest] = featured.photos;
        return lead ? [lead, ...rest.sort((a, b) => rankOf(a.photoKey) - rankOf(b.photoKey))] : [];
    }, [featured, ranks]);

    useEffect(() => {
        if (!isLoading) hideSplash();
    }, [isLoading]);

    if (isLoading) return null;
    if (isError || !featured?.enabled) return <Navigate to="/" replace />;

    const albumUrl = `/?folder=${encodeURIComponent(featured.folderId)}`;

    return (
        <FeaturedDisplay
            content={featured}
            images={photos.map((p) => ({ url: p.imageUrl, alt: featured.title || featured.folderDisplayName }))}
            onOpenPhoto={(i) => navigate(`${albumUrl}&photo=${encodeURIComponent(photos[i].photoKey)}`)}
            onViewAlbum={() => navigate(albumUrl)}
            onContinue={() => navigate(viewerLocation())}
        />
    );
}
