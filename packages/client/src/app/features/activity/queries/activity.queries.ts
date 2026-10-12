import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActivityStatus } from '../models/activity.models';
import type { ActivityService } from '../services/activity.service';

export const ActivityQueryKeys = {
    all: ['Activity'] as const,
    feed: ['Activity', 'Feed'] as const,
    status: ['Activity', 'Status'] as const,
} as const;

export const createActivityQueries = (service: ActivityService) => {
    const useGetFeed = () =>
        useInfiniteQuery({
            queryKey: ActivityQueryKeys.feed,
            queryFn: ({ pageParam }) => service.getPage(pageParam),
            initialPageParam: null as string | null,
            getNextPageParam: (last) => last.nextCursor,
            staleTime: 60 * 1000,
        });

    /** Drives the header badge, so it checks in now and then as well as on focus. */
    const useGetStatus = () =>
        useQuery({
            queryKey: ActivityQueryKeys.status,
            queryFn: () => service.getStatus(),
            staleTime: 60 * 1000,
            refetchInterval: 5 * 60 * 1000,
        });

    const useMarkSeen = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: () => service.markSeen(),
            onSuccess: () => {
                qc.setQueryData<ActivityStatus>(ActivityQueryKeys.status, (s) => (s ? { ...s, unseenCount: 0 } : s));
                qc.invalidateQueries({ queryKey: ActivityQueryKeys.status });
            },
        });
    };

    return { useGetFeed, useGetStatus, useMarkSeen };
};

export type ActivityQueries = ReturnType<typeof createActivityQueries>;
