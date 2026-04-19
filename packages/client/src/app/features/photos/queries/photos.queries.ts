import type { PhotosService } from '@/app/features/photos/services/photos.service';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

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

    const useGetPhotosForFolders = (folderIds: string[]) => {
        return useQueries({
            queries: folderIds.map((folderId) => ({
                queryKey: PhotosQueryKeys.photos(folderId),
                queryFn: () => service.getPhotos(folderId),
                staleTime: 10 * 60 * 1000,
            })),
        });
    };

    const useSetFolderCover = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ folderId, fileName }: { folderId: string; fileName: string }) => service.setFolderCover(folderId, fileName),
            onSuccess: () => qc.invalidateQueries({ queryKey: PhotosQueryKeys.folders }),
        });
    };

    const useClearFolderCover = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ folderId }: { folderId: string }) => service.clearFolderCover(folderId),
            onSuccess: () => qc.invalidateQueries({ queryKey: PhotosQueryKeys.folders }),
        });
    };

    const useRatePhoto = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ catalogId, rating }: { catalogId: string; folderId: string; rating: number }) =>
                rating === 0 ? service.clearRating(catalogId) : service.ratePhoto(catalogId, rating),
            onSuccess: (_, { folderId }) => qc.invalidateQueries({ queryKey: PhotosQueryKeys.photos(folderId) }),
        });
    };

    return {
        useGetFolders,
        useGetPhotos,
        useGetPhotosForFolders,
        useSetFolderCover,
        useClearFolderCover,
        useRatePhoto,
    };
};

export type PhotosQueries = ReturnType<typeof createPhotosQueries>;
