import type { PhotosService } from '@/app/features/photos/services/photos.service';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

export const PhotosQueryKeys = {
    folders: ['Photos', 'Folders'] as const,
    photos: (folderId: string) => ['Photos', 'Photos', folderId] as const,
    favorites: (offset: number, limit: number) => ['Photos', 'Favorites', offset, limit] as const,
    favoritesAll: ['Photos', 'Favorites'] as const,
    shareLink: (folderId: string, itemId: string) => ['Photos', 'ShareLink', folderId, itemId] as const,
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

    const useSetPreferredPhoto = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ catalogId }: { catalogId: string; folderId: string }) => service.setPreferredPhoto(catalogId),
            onSuccess: (_, { folderId }) => {
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.photos(folderId) });
            },
        });
    };

    const useRatePhoto = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ catalogId, rating }: { catalogId: string; folderId?: string; rating: number }) =>
                rating === 0 ? service.clearRating(catalogId) : service.ratePhoto(catalogId, rating),
            onSuccess: (_, { folderId }) => {
                if (folderId) qc.invalidateQueries({ queryKey: PhotosQueryKeys.photos(folderId) });
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.favoritesAll });
            },
        });
    };

    const useGetFavorites = (offset: number, limit: number) => {
        return useQuery({
            queryKey: PhotosQueryKeys.favorites(offset, limit),
            queryFn: () => service.getFavorites(offset, limit),
            staleTime: 5 * 60 * 1000,
        });
    };

    const useGetShareLink = (folderId: string | null, itemId: string | null) => {
        return useQuery({
            queryKey: PhotosQueryKeys.shareLink(folderId!, itemId!),
            queryFn: () => service.getShareLink(folderId!, itemId!),
            enabled: !!folderId && !!itemId,
            staleTime: Infinity,
        });
    };

    return {
        useGetFolders,
        useGetPhotos,
        useGetPhotosForFolders,
        useSetFolderCover,
        useClearFolderCover,
        useSetPreferredPhoto,
        useRatePhoto,
        useGetFavorites,
        useGetShareLink,
    };
};

export type PhotosQueries = ReturnType<typeof createPhotosQueries>;
