import type { GalleryInput } from '@/app/features/galleries/models/galleries.models';
import type { GalleriesService } from '@/app/features/galleries/services/galleries.service';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const GalleriesQueryKeys = {
    all: ['Galleries'] as const,
    list: ['Galleries', 'List'] as const,
    covers: ['Galleries', 'Covers'] as const,
    photos: (id: string) => ['Galleries', 'Photos', id] as const,
} as const;

export const createGalleriesQueries = (service: GalleriesService) => {
    const useGetGalleries = () =>
        useQuery({
            queryKey: GalleriesQueryKeys.list,
            queryFn: () => service.getGalleries(),
        });

    const useGetGalleryCovers = () =>
        useQuery({
            queryKey: GalleriesQueryKeys.covers,
            queryFn: () => service.getGalleryCovers(),
            staleTime: 10 * 60 * 1000,
        });

    // Download URLs in the response are short-lived OneDrive links, as with album photos.
    const useGetGalleryPhotos = (id: string | null) =>
        useQuery({
            queryKey: GalleriesQueryKeys.photos(id!),
            queryFn: () => service.getGalleryPhotos(id!),
            enabled: !!id,
            staleTime: 10 * 60 * 1000,
        });

    // Any change can alter a gallery's photos, cover and count, so refresh everything.
    const useCreateGallery = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (input: GalleryInput) => service.createGallery(input),
            onSuccess: () => qc.invalidateQueries({ queryKey: GalleriesQueryKeys.all }),
        });
    };

    const useUpdateGallery = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ id, input }: { id: string; input: GalleryInput }) => service.updateGallery(id, input),
            onSuccess: () => qc.invalidateQueries({ queryKey: GalleriesQueryKeys.all }),
        });
    };

    const useDeleteGallery = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (id: string) => service.deleteGallery(id),
            onSuccess: () => qc.invalidateQueries({ queryKey: GalleriesQueryKeys.all }),
        });
    };

    return { useGetGalleries, useGetGalleryCovers, useGetGalleryPhotos, useCreateGallery, useUpdateGallery, useDeleteGallery };
};

export type GalleriesQueries = ReturnType<typeof createGalleriesQueries>;
