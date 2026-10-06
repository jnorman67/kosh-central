import type { FeaturedAlbumConfigInput } from '@/app/features/featured/models/featured.models';
import type { FeaturedService } from '@/app/features/featured/services/featured.service';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const FeaturedQueryKeys = {
    all: ['Featured'] as const,
    featured: ['Featured', 'Public'] as const,
    config: ['Featured', 'Config'] as const,
} as const;

export const createFeaturedQueries = (service: FeaturedService) => {
    // The photo URL is a short-lived OneDrive download link, so don't hold onto it as long as
    // the album config itself would warrant.
    const useGetFeatured = () =>
        useQuery({
            queryKey: FeaturedQueryKeys.featured,
            queryFn: () => service.getFeatured(),
            staleTime: 10 * 60 * 1000,
        });

    const useGetConfig = () =>
        useQuery({
            queryKey: FeaturedQueryKeys.config,
            queryFn: () => service.getConfig(),
        });

    const useUpdateConfig = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (input: FeaturedAlbumConfigInput) => service.updateConfig(input),
            onSuccess: (config) => {
                qc.setQueryData(FeaturedQueryKeys.config, config);
                qc.invalidateQueries({ queryKey: FeaturedQueryKeys.featured });
            },
        });
    };

    return { useGetFeatured, useGetConfig, useUpdateConfig };
};

export type FeaturedQueries = ReturnType<typeof createFeaturedQueries>;
