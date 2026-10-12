import { CommentBody } from '@/app/features/comments/components/comment-body';
import { CommentForm } from '@/app/features/comments/components/comment-form';
import type { Comment, MentionInput } from '@/app/features/comments/models/comments.models';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { formatSince, parseServerDate } from '../lib/time';
import type { ActivityItem } from '../models/activity.models';

interface ActivityCardProps {
    item: ActivityItem;
    currentUserId: string;
    /** Comments from others after this are marked new; null marks none (the first visit). */
    since: string | null;
    highlighted?: boolean;
    onOpenPhoto: () => void;
    onOpenAlbum: () => void;
    onReply: (body: string, mentions: MentionInput[]) => Promise<void>;
}

/** One commented photo in the activity feed: the photo, its latest comments, and a reply box. */
export function ActivityCard({ item, currentUserId, since, highlighted, onOpenPhoto, onOpenAlbum, onReply }: ActivityCardProps) {
    const [replying, setReplying] = useState(false);
    const [posting, setPosting] = useState(false);
    const [replyError, setReplyError] = useState<string | null>(null);
    const sinceTime = since ? parseServerDate(since).getTime() : null;
    const isNew = (c: Comment) => sinceTime !== null && c.authorId !== currentUserId && parseServerDate(c.createdAt).getTime() > sinceTime;
    const hasNew = item.comments.some(isNew);
    const earlier = item.commentCount - item.comments.length;

    async function handleReply(body: string, mentions: MentionInput[]) {
        setPosting(true);
        setReplyError(null);
        try {
            await onReply(body, mentions);
            setReplying(false);
        } catch (err) {
            setReplyError(err instanceof Error ? err.message : 'Your reply couldn’t be posted.');
        } finally {
            setPosting(false);
        }
    }

    return (
        <article
            data-place-item={item.bundleId}
            className={cn(
                'overflow-hidden border-y border-amber-200 bg-background sm:rounded-lg sm:border',
                highlighted && 'ring-2 ring-amber-400',
            )}
        >
            <header className="flex items-center justify-between gap-3 px-4 py-2.5">
                <button
                    type="button"
                    onClick={onOpenAlbum}
                    className="min-w-0 truncate text-sm font-semibold text-amber-900 hover:underline"
                >
                    {item.photo.folderDisplayName}
                </button>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {hasNew && <span className="rounded-full bg-rose-500 px-2 py-0.5 font-semibold text-white">New</span>}
                    <time dateTime={parseServerDate(item.lastCommentAt).toISOString()}>{formatSince(item.lastCommentAt)}</time>
                </div>
            </header>

            {/* A fixed frame, letterboxed like the viewer, keeps the feed from jumping as photos load. */}
            <button
                type="button"
                onClick={onOpenPhoto}
                className="block aspect-[4/3] w-full bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                aria-label={`Open ${item.photo.name} in ${item.photo.folderDisplayName}`}
            >
                <img src={item.photo.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
            </button>

            <div className="flex flex-col gap-2 px-4 pb-3 pt-3">
                {earlier > 0 && (
                    <button type="button" onClick={onOpenPhoto} className="self-start text-sm text-muted-foreground hover:underline">
                        View all {item.commentCount} comments
                    </button>
                )}
                <ul className="flex flex-col gap-2">
                    {item.comments.map((c) => (
                        <li
                            key={c.id}
                            className={cn('text-sm', isNew(c) && '-mx-2 rounded-md border-l-2 border-rose-400 bg-rose-50 px-2 py-1')}
                        >
                            <span className="font-semibold">{c.authorDisplayName}</span> <CommentBody body={c.body} />{' '}
                            <span className="whitespace-nowrap text-xs text-muted-foreground">{formatSince(c.createdAt)}</span>
                        </li>
                    ))}
                </ul>
                {replyError && <p className="text-sm text-destructive">{replyError}</p>}
                {replying ? (
                    <CommentForm
                        photoId={item.photo.catalogId}
                        onSubmit={handleReply}
                        onCancel={() => setReplying(false)}
                        isSubmitting={posting}
                        submitLabel="Reply"
                    />
                ) : (
                    <Button variant="ghost" size="sm" onClick={() => setReplying(true)} className="-ml-2 self-start text-muted-foreground">
                        <MessageCircle className="h-4 w-4" />
                        Reply
                    </Button>
                )}
            </div>
        </article>
    );
}
