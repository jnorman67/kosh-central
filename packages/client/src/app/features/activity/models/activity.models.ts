import type { Comment } from '@/app/features/comments/models/comments.models';

/** Where a commented photo lives, so the feed can show it and open it in the viewer. */
export interface ActivityPhoto {
    catalogId: string;
    name: string;
    /** Cached thumbnail proxy URL. */
    imageUrl: string;
    folderId: string;
    folderDisplayName: string;
    /** The viewer's `path` parameter: the subfolder of a browse album holding the photo, else ''. */
    path: string;
    /** The viewer's `photo` parameter. */
    photoKey: string;
}

/** One photo in the activity feed. */
export interface ActivityItem {
    bundleId: string;
    lastCommentAt: string;
    commentCount: number;
    photo: ActivityPhoto;
    /** The latest few comments, oldest first. */
    comments: Comment[];
}

export interface ActivityPage {
    items: ActivityItem[];
    /** Pass back to fetch the next page; null on the last page. */
    nextCursor: string | null;
}

export interface ActivityStatus {
    /** When the user last opened the feed; null if never. */
    seenAt: string | null;
    /** Photos others have commented on since then. */
    unseenCount: number;
}
