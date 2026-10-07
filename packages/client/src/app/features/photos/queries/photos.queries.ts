import type { PhotosService } from '@/app/features/photos/services/photos.service';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const PhotosQueryKeys = {
    folders: ['Photos', 'Folders'] as const,
    folderCovers: ['Photos', 'FolderCovers'] as const,
    photos: (folderId: string, view: 'gallery' | 'pages', path: string) => ['Photos', 'Photos', folderId, view, path] as const,
    allPhotos: (folderId: string) => ['Photos', 'Photos', folderId, 'all'] as const,
    folderPhotos: (folderId: string) => ['Photos', 'Photos', folderId] as const,
    favoritesInfinite: (limit: number) => ['Photos', 'Favorites', 'infinite', limit] as const,
    favoritesAll: ['Photos', 'Favorites'] as const,
    shareLink: (folderId: string, itemId: string) => ['Photos', 'ShareLink', folderId, itemId] as const,
    faces: (photoId: string) => ['Photos', 'Faces', photoId] as const,
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

    const useGetPhotos = (folderId: string | null, view: 'gallery' | 'pages' = 'gallery', path = '') => {
        return useQuery({
            queryKey: PhotosQueryKeys.photos(folderId!, view, path),
            queryFn: () => service.getPhotos(folderId!, view, path),
            enabled: !!folderId,
            staleTime: 10 * 60 * 1000,
        });
    };

    const useGetAllPhotos = (folderId: string | null) => {
        return useQuery({
            queryKey: PhotosQueryKeys.allPhotos(folderId!),
            queryFn: () => service.getAllPhotos(folderId!),
            enabled: !!folderId,
            staleTime: 10 * 60 * 1000,
        });
    };

    const useSetFolderCover = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ folderId, fileName, path }: { folderId: string; fileName: string; path?: string }) =>
                service.setFolderCover(folderId, fileName, path),
            onSuccess: (_, { folderId }) => {
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.folders });
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.folderCovers });
                // Photos responses carry the current path's cover and the subfolder tiles' covers.
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.folderPhotos(folderId) });
            },
        });
    };

    const useClearFolderCover = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ folderId, path }: { folderId: string; path?: string }) => service.clearFolderCover(folderId, path),
            onSuccess: (_, { folderId }) => {
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.folders });
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.folderCovers });
                qc.invalidateQueries({ queryKey: PhotosQueryKeys.folderPhotos(folderId) });
            },
        });
    };

    const useRatePhoto = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ catalogId, rating }: { catalogId: string; folderId?: string; rating: number }) =>
                rating === 0 ? service.clearRating(catalogId) : service.ratePhoto(catalogId, rating),
            onSuccess: (_, { folderId }) => {
                if (folderId) qc.invalidateQueries({ queryKey: PhotosQueryKeys.folderPhotos(folderId) });
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

    const useGetFaces = (photoId: string | null | undefined, enabled: boolean) => {
        return useQuery({
            queryKey: PhotosQueryKeys.faces(photoId!),
            queryFn: () => service.getFaces(photoId!),
            enabled: !!photoId && enabled,
            staleTime: Infinity,
        });
    };

    return {
        useGetFolders,
        useGetFolderCovers,
        useGetPhotos,
        useGetAllPhotos,
        useSetFolderCover,
        useClearFolderCover,
        useRatePhoto,
        useGetFavoritesInfinite,
        useGetShareLink,
        useGetFaces,
    };
};

export type PhotosQueries = ReturnType<typeof createPhotosQueries>;
