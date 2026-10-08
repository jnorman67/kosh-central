import { createGalleriesQueries, type GalleriesQueries } from '@/app/features/galleries/queries/galleries.queries';
import { GalleriesService } from '@/app/features/galleries/services/galleries.service';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface GalleriesQueriesType {
    galleries: GalleriesQueries;
}

const GalleriesQueryContext = createContext<GalleriesQueriesType | undefined>(undefined);

export function GalleriesQueryProvider({ children }: { children: ReactNode }) {
    const services = useMemo(() => ({ galleriesService: new GalleriesService() }), []);
    const queries = useMemo(() => ({ galleries: createGalleriesQueries(services.galleriesService) }), [services]);

    return <GalleriesQueryContext.Provider value={queries}>{children}</GalleriesQueryContext.Provider>;
}

export function useGalleriesQueries() {
    const context = useContext(GalleriesQueryContext);
    if (!context) {
        throw new Error('useGalleriesQueries must be used within a GalleriesQueryProvider');
    }
    return context.galleries;
}
