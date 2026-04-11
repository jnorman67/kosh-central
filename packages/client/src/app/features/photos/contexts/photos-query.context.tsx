import { createPhotosQueries, type PhotosQueries } from '@/app/features/photos/queries/photos.queries';
import { PhotosService } from '@/app/features/photos/services/photos.service';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface PhotosQueriesType {
    photos: PhotosQueries;
}

const PhotosQueryContext = createContext<PhotosQueriesType | undefined>(undefined);

export function PhotosQueryProvider({ children }: { children: ReactNode }) {
    const services = useMemo(() => ({ photosService: new PhotosService() }), []);
    const queries = useMemo(() => ({ photos: createPhotosQueries(services.photosService) }), [services]);

    return <PhotosQueryContext.Provider value={queries}>{children}</PhotosQueryContext.Provider>;
}

export function usePhotosQueries() {
    const context = useContext(PhotosQueryContext);
    if (!context) {
        throw new Error('usePhotosQueries must be used within a PhotosQueryProvider');
    }
    return context.photos;
}
