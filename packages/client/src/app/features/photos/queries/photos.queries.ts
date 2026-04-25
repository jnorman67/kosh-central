import type { PhotosService } from '@/app/features/photos/services/photos.service';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const PhotosQueryKeys = {
    folders: ['Photos', 'Folders'] as const,
    folderCovers: ['Photos', 'FolderCovers'] as const,
    photos: (folderId: string, view: 'gallery' | 'pages') => ['Photos', 'Photos', folderId, view] as const,
    favoritesInfinite: (limit: number) => ['Photos', 'Favorites', 'infinite', limit] as const,
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

    const useGetFolderCovers = () => {
        return useQuery({
            queryKey: PhotosQueryKeys.folderCovers,
            queryFn: () => service.getFolderCovers(),
            staleTime: 10 * 60 * 1000,
        });
    };

    const useGetPhotos = (folderId: string | null, view: 'gallery' | 'pages' = 'gallery') => {
        return useQuery({
            queryKey: PhotosQueryKeys.photos(folderId!, view),
            queryFn: () => service.getPhotos(folderId!, view),
            enabled: !!folderId,
            staleTime: 10 * 60 * 1000,
        });
    };

    const useSetFolderCover = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ folderId, fileName }: { folderId: string; fileName: string }) => service.setFolderCover(folderId, fileName),
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.folders });
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.folderCovers });
            },
        });
    };

    const useClearFolderCover = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ folderId }: { folderId: string }) => service.clearFolderCover(folderId),
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.folders });
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.folderCovers });
            },
        });
    };

    const useSetPreferredPhoto = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ catalogId }: { catalogId: string; folderId: string }) => service.setPreferredPhoto(catalogId),
            onSuccess: (_, { folderId }) => {
                qc.invalidateQueries({ queryKey: ['Photos', 'Photos', folderId] });
            },
        });
    };

    const useRatePhoto = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ catalogId, rating }: { catalogId: string; folderId?: string; rating: number }) =>
                rating === 0 ? service.clearRating(catalogId) : service.ratePhoto(catalogId, rating),
            onSuccess: (_, { folderId }) => {
                if (folderId) qc.invalidateQueries({ queryKey: ['Photos', 'Photos', folderId] });
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.favoritesAll });
            },
        });
    };

    const useGetFavoritesInfinite = (limit: number) => {
        return useInfiniteQuery({
            queryKey: PhotosQueryKeys.favoritesInfinite(limit),
            queryFn: ({ pageParam }) => service.getFavorites(pageParam, limit),
            initialPageParam: 0,
            getNextPageParam: (lastPage) => {
                const nextOffset = lastPage.offset + lastPage.photos.length;
                return nextOffset < lastPage.total ? nextOffset : undefined;
            },
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
        useGetFolderCovers,
        useGetPhotos,
        useSetFolderCover,
        useClearFolderCover,
        useSetPreferredPhoto,
        useRatePhoto,
        useGetFavoritesInfinite,
        useGetShareLink,
    };
};

export type PhotosQueries = ReturnType<typeof createPhotosQueries>;
