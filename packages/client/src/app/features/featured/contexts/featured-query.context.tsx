import { createFeaturedQueries, type FeaturedQueries } from '@/app/features/featured/queries/featured.queries';
import { FeaturedService } from '@/app/features/featured/services/featured.service';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface FeaturedQueriesType {
    featured: FeaturedQueries;
}

const FeaturedQueryContext = createContext<FeaturedQueriesType | undefined>(undefined);

export function FeaturedQueryProvider({ children }: { children: ReactNode }) {
    const services = useMemo(() => ({ featuredService: new FeaturedService() }), []);
    const queries = useMemo(() => ({ featured: createFeaturedQueries(services.featuredService) }), [services]);

    return <FeaturedQueryContext.Provider value={queries}>{children}</FeaturedQueryContext.Provider>;
}

export function useFeaturedQueries() {
    const context = useContext(FeaturedQueryContext);
    if (!context) {
        throw new Error('useFeaturedQueries must be used within a FeaturedQueryProvider');
    }
    return context.featured;
}
