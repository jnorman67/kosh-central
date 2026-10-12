import { ActivityQueryKeys } from '@/app/features/activity/queries/activity.queries';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MentionInput } from '../models/comments.models';
import type { CommentsService } from '../services/comments.service';

export const CommentsQueryKeys = {
    forPhoto: (photoId: string) => ['Comments', 'Photo', photoId] as const,
    users: ['Comments', 'Users'] as const,
} as const;

/** The activity feed lists photos by their latest comment, so any change leaves it out of date. It's
 *  only marked stale, not refetched, so a reply posted from the feed doesn't reorder it under the reader. */
function markActivityStale(qc: ReturnType<typeof useQueryClient>) {
    qc.invalidateQueries({ queryKey: ActivityQueryKeys.all, refetchType: 'none' });
}

export const createCommentsQueries = (service: CommentsService) => {
    const useGetComments = (photoId: string | null) =>
        useQuery({
            queryKey: CommentsQueryKeys.forPhoto(photoId!),
            queryFn: () => service.getComments(photoId!),
            enabled: !!photoId,
            staleTime: 30 * 1000,
        });

    const useGetUsers = () =>
        useQuery({
            queryKey: CommentsQueryKeys.users,
            queryFn: () => service.getUsers(),
            staleTime: 5 * 60 * 1000,
        });

    const useCreateComment = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ photoId, body, mentions }: { photoId: string; body: string; mentions: MentionInput[] }) =>
                service.createComment(photoId, body, mentions),
            onSuccess: (_, { photoId }) => {
                qc.invalidateQueries({ queryKey: CommentsQueryKeys.forPhoto(photoId) });
                markActivityStale(qc);
            },
        });
    };

    const useUpdateComment = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({
                commentId,
                photoId,
                body,
                mentions,
            }: {
                commentId: string;
                photoId: string;
                body: string;
                mentions: MentionInput[];
            }) => service.updateComment(commentId, body, mentions),
            onSuccess: (_, { photoId }) => {
                qc.invalidateQueries({ queryKey: CommentsQueryKeys.forPhoto(photoId) });
                markActivityStale(qc);
            },
        });
    };

    const useDeleteComment = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ commentId }: { commentId: string; photoId: string }) => service.deleteComment(commentId),
            onSuccess: (_, { photoId }) => {
                qc.invalidateQueries({ queryKey: CommentsQueryKeys.forPhoto(photoId) });
                markActivityStale(qc);
            },
        });
    };

    return { useGetComments, useGetUsers, useCreateComment, useUpdateComment, useDeleteComment };
};

export type CommentsQueries = ReturnType<typeof createCommentsQueries>;
