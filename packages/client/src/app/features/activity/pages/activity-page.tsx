import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { useCommentsQueries } from '@/app/features/comments/contexts/comments-query.context';
import type { MentionInput } from '@/app/features/comments/models/comments.models';
import { usePlaceMemory } from '@/app/features/photos/hooks/use-place-memory';
import { updatePlace, viewerLocation } from '@/app/features/photos/lib/places';
import { BrandMark } from '@/components/layout/brand-mark';
import { UserMenu } from '@/components/layout/user-menu';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { hideSplash } from '@/lib/splash';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useNavigationType } from 'react-router-dom';
import { ActivityCard } from '../components/activity-card';
import { useActivityQueries } from '../contexts/activity-query.context';
import type { ActivityItem, ActivityPage as ActivityPageData } from '../models/activity.models';
import { ActivityQueryKeys } from '../queries/activity.queries';

const ACTIVITY_PLACE = 'activity';
/** Coming back to the feed within this long of the last visit keeps the same comments marked new. */
const VISIT_WINDOW_MS = 30 * 60 * 1000;

/** The "new since" time of the current visit, kept across trips into the viewer and back. */
let visit: { since: string | null; at: number } | undefined;

/** Photos with the latest comments, newest first, scrolling on like a social feed. */
export function ActivityPage() {
    const navigate = useNavigate();
    const navigationType = useNavigationType();
    const qc = useQueryClient();
    const { useGetMe } = useAuthQueries();
    const { data: me } = useGetMe();
    const { useGetFeed, useMarkSeen } = useActivityQueries();
    const { useCreateComment } = useCommentsQueries();
    const createComment = useCreateComment();
    const { mutateAsync: markSeen } = useMarkSeen();

    // Arriving afresh starts at the top with the latest; coming back (browser back, reload) picks up where the user was.
    useState(() => {
        if (navigationType === 'POP') return;
        qc.removeQueries({ queryKey: ActivityQueryKeys.feed });
        updatePlace(ACTIVITY_PLACE, { scrollTop: 0, focus: undefined });
    });

    const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetFeed();
    const items = data?.pages.flatMap((p) => p.items) ?? [];
    const { ref: scrollRef, focus } = usePlaceMemory<HTMLDivElement>(ACTIVITY_PLACE, !!data);

    // Opening the feed marks everything seen, which clears the header badge. What was new since the
    // previous visit stays marked for this visit, including after a trip into the viewer and back.
    const [since, setSince] = useState<string | null>(() => visit?.since ?? null);
    const markedRef = useRef(false);
    useEffect(() => {
        if (markedRef.current) return;
        markedRef.current = true;
        // The promise, not mutate()'s callbacks: those are dropped if the component remounts
        // (StrictMode does) before the request returns.
        markSeen().then(
            ({ previousSeenAt }) => {
                const continuing = visit && Date.now() - visit.at < VISIT_WINDOW_MS;
                visit = { since: continuing ? visit!.since : previousSeenAt, at: Date.now() };
                setSince(visit.since);
            },
            () => {},
        );
    }, [markSeen]);

    useEffect(() => {
        if (!isLoading) hideSplash();
    }, [isLoading]);

    // Load the next page as the end of the feed comes near. Staying in view after a short page
    // (photos no album lists any more are dropped) keeps loading until the screen fills.
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [nearEnd, setNearEnd] = useState(false);
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(([entry]) => setNearEnd(entry.isIntersecting), {
            root: scrollRef.current,
            rootMargin: '0px 0px 1200px 0px',
        });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [scrollRef, data]);
    useEffect(() => {
        if (nearEnd && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [nearEnd, hasNextPage, isFetchingNextPage, fetchNextPage]);

    function openPhoto(item: ActivityItem) {
        updatePlace(ACTIVITY_PLACE, { focus: item.bundleId });
        const params = new URLSearchParams({ folder: item.photo.folderId });
        if (item.photo.path) params.set('path', item.photo.path);
        params.set('photo', item.photo.photoKey);
        navigate(`/?${params}`, { state: { openedFromActivity: true } });
    }

    function openAlbum(item: ActivityItem) {
        updatePlace(ACTIVITY_PLACE, { focus: item.bundleId });
        const params = new URLSearchParams({ folder: item.photo.folderId });
        if (item.photo.path) params.set('path', item.photo.path);
        navigate(`/?${params}`);
    }

    /** Post a reply and show it on the card in place, without reordering the feed under the reader. */
    async function reply(item: ActivityItem, body: string, mentions: MentionInput[]) {
        const comment = await createComment.mutateAsync({ photoId: item.photo.catalogId, body, mentions });
        qc.setQueryData<InfiniteData<ActivityPageData>>(ActivityQueryKeys.feed, (old) =>
            old
                ? {
                      ...old,
                      pages: old.pages.map((page) => ({
                          ...page,
                          items: page.items.map((i) =>
                              i.bundleId === item.bundleId
                                  ? { ...i, comments: [...i.comments, comment], commentCount: i.commentCount + 1 }
                                  : i,
                          ),
                      })),
                  }
                : old,
        );
    }

    return (
        <ViewerLayout
            header={
                <div className="flex min-h-[52px] items-center justify-between gap-2 pl-1 sm:pl-0">
                    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                        <BrandMark onClick={() => navigate(viewerLocation())} title="Back to albums" />
                        <h1 className="truncate px-1 text-[15px] font-semibold text-amber-950 sm:text-sm sm:font-medium sm:text-foreground">
                            Activity
                        </h1>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pr-1 sm:gap-3 sm:px-4">
                        <UserMenu />
                    </div>
                </div>
            }
            viewer={
                <div ref={scrollRef} className="h-full overflow-auto bg-amber-50/40">
                    <div className="mx-auto flex max-w-xl flex-col gap-3 py-3 sm:gap-5 sm:px-4 sm:py-6">
                        <p className="px-4 text-sm text-muted-foreground sm:px-0">Photos with the latest comments, newest first.</p>
                        {isLoading ? (
                            <FeedMessage>
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </FeedMessage>
                        ) : isError ? (
                            <FeedMessage>The feed couldn’t be loaded. Try again in a moment.</FeedMessage>
                        ) : items.length === 0 && !hasNextPage ? (
                            <FeedMessage>No one has commented on a photo yet.</FeedMessage>
                        ) : (
                            items.map((item) => (
                                <ActivityCard
                                    key={item.bundleId}
                                    item={item}
                                    currentUserId={me?.id ?? ''}
                                    since={since}
                                    highlighted={focus === item.bundleId}
                                    onOpenPhoto={() => openPhoto(item)}
                                    onOpenAlbum={() => openAlbum(item)}
                                    onReply={(body, mentions) => reply(item, body, mentions)}
                                />
                            ))
                        )}
                        <div ref={sentinelRef} />
                        {isFetchingNextPage && (
                            <FeedMessage>
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </FeedMessage>
                        )}
                        {data && !hasNextPage && items.length > 0 && <FeedMessage>You’re all caught up.</FeedMessage>}
                    </div>
                </div>
            }
        />
    );
}

function FeedMessage({ children }: { children: ReactNode }) {
    return <div className="flex justify-center px-4 py-8 text-sm text-muted-foreground">{children}</div>;
}
