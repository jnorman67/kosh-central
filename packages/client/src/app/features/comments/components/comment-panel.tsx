import { useCommentsQueries } from '../contexts/comments-query.context';
import type { MentionInput } from '../models/comments.models';
import { CommentForm } from './comment-form';
import { CommentList } from './comment-list';

interface CommentPanelProps {
    photoId: string;
    currentUserId: string;
    isAdmin: boolean;
    className?: string;
}

export function CommentPanel({ photoId, currentUserId, isAdmin, className }: CommentPanelProps) {
    const { useGetComments, useCreateComment } = useCommentsQueries();
    const { data: comments = [], isLoading } = useGetComments(photoId);
    const createMutation = useCreateComment();

    function handleCreate(body: string, mentions: MentionInput[]) {
        createMutation.mutate({ photoId, body, mentions });
    }

    return (
        <div className={`flex flex-col overflow-hidden ${className ?? ''}`}>
            <div className="border-b border-amber-200 px-4 py-2">
                <h3 className="text-sm font-semibold text-amber-900">
                    Comments {comments.length > 0 && <span className="text-muted-foreground font-normal">({comments.length})</span>}
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4">
                {isLoading ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
                ) : (
                    <CommentList comments={comments} currentUserId={currentUserId} isAdmin={isAdmin} />
                )}
            </div>
            <div className="shrink-0 border-t border-amber-200 p-4">
                <CommentForm
                    photoId={photoId}
                    onSubmit={handleCreate}
                    isSubmitting={createMutation.isPending}
                />
            </div>
        </div>
    );
}
