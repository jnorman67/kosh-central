import type { PhotosService } from '@/app/features/photos/services/photos.service';
import { useQuery } from '@tanstack/react-query';

export const PhotosQueryKeys = {
    folders: ['Photos', 'Folders'] as const,
    photos: (folderId: string) => ['Photos', 'Photos', folderId] as const,
} as const;

export const createPhotosQueries = (service: PhotosService) => {
    const useGetFolders = () => {
        return useQuery({
            queryKey: PhotosQueryKeys.folders,
            queryFn: () => service.getFolders(),
            staleTime: Infinity,
        });
    };

    const useGetPhotos = (folderId: string | null) => {
        return useQuery({
            queryKey: PhotosQueryKeys.photos(folderId!),
            queryFn: () => service.getPhotos(folderId!),
            enabled: !!folderId,
            staleTime: 10 * 60 * 1000,
        });
    };

    return {
        useGetFolders,
        useGetPhotos,
    };
};

export type PhotosQueries = ReturnType<typeof createPhotosQueries>;
