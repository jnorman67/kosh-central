import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useCommentsQueries } from '../contexts/comments-query.context';
import type { Comment, MentionInput } from '../models/comments.models';
import { CommentBody } from './comment-body';
import { CommentForm } from './comment-form';

interface CommentItemProps {
    comment: Comment;
    currentUserId: string;
    isAdmin: boolean;
}

export function CommentItem({ comment, currentUserId, isAdmin }: CommentItemProps) {
    const [editing, setEditing] = useState(false);
    const { useUpdateComment, useDeleteComment } = useCommentsQueries();
    const updateMutation = useUpdateComment();
    const deleteMutation = useDeleteComment();

    const canModify = currentUserId === comment.authorId || isAdmin;

    const formattedDate = new Date(comment.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    function handleUpdate(body: string, mentions: MentionInput[]) {
        updateMutation.mutate(
            { commentId: comment.id, photoId: comment.photoId, body, mentions },
            { onSuccess: () => setEditing(false) },
        );
    }

    function handleDelete() {
        deleteMutation.mutate({ commentId: comment.id, photoId: comment.photoId });
    }

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{comment.authorDisplayName}</span>
                <div className="flex shrink-0 items-center gap-1">
                    <span className="text-xs text-muted-foreground">{formattedDate}</span>
                    {comment.editedAt && (
                        <span className="text-xs text-muted-foreground">(edited)</span>
                    )}
                    {canModify && !editing && (
                        <>
                            {currentUserId === comment.authorId && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1 text-xs text-muted-foreground"
                                    onClick={() => setEditing(true)}
                                >
                                    Edit
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-xs text-muted-foreground"
                                onClick={handleDelete}
                                disabled={deleteMutation.isPending}
                            >
                                Delete
                            </Button>
                        </>
                    )}
                </div>
            </div>
            {editing ? (
                <CommentForm
                    photoId={comment.photoId}
                    initialBody={comment.body}
                    initialMentions={comment.mentions.map((m) => ({
                        mentionType: m.mentionType,
                        mentionedId: m.mentionedId,
                    }))}
                    onSubmit={handleUpdate}
                    onCancel={() => setEditing(false)}
                    isSubmitting={updateMutation.isPending}
                    submitLabel="Save"
                />
            ) : (
                <p className="text-sm text-foreground">
                    <CommentBody body={comment.body} />
                </p>
            )}
        </div>
    );
}
