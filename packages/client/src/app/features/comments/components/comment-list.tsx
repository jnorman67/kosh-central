import type { Comment } from '../models/comments.models';
import { CommentItem } from './comment-item';

interface CommentListProps {
    comments: Comment[];
    currentUserId: string;
    isAdmin: boolean;
}

export function CommentList({ comments, currentUserId, isAdmin }: CommentListProps) {
    if (comments.length === 0) {
        return <p className="py-4 text-center text-sm text-muted-foreground">No comments yet.</p>;
    }

    return (
        <div className="flex flex-col divide-y divide-border">
            {comments.map((c) => (
                <div key={c.id} className="py-3">
                    <CommentItem comment={c} currentUserId={currentUserId} isAdmin={isAdmin} />
                </div>
            ))}
        </div>
    );
}
