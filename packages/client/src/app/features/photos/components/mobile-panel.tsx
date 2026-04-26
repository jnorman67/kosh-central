import { CommentPanel } from '@/app/features/comments/components/comment-panel';
import { SubjectsQueryProvider } from '@/app/features/photos/contexts/subjects-query.context';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SubjectsPanel } from './subjects-panel';

interface MobilePanelProps {
    photoId: string;
    currentUserId: string;
    isAdmin: boolean;
    initialBody?: string;
    onCommentPosted?: () => void;
    onDisputeSubject: (personId: string, personName: string) => void;
}

export function MobilePanel({ photoId, currentUserId, isAdmin, initialBody, onCommentPosted, onDisputeSubject }: MobilePanelProps) {
    const [peopleOpen, setPeopleOpen] = useState(false);
    const [commentsOpen, setCommentsOpen] = useState(false);

    // Collapse both sections when the photo changes.
    useEffect(() => {
        setPeopleOpen(false);
        setCommentsOpen(false);
    }, [photoId]);

    // Auto-open comments when a dispute body is set (after flagging a subject).
    useEffect(() => {
        if (initialBody) setCommentsOpen(true);
    }, [initialBody]);

    function handleDisputeSubject(personId: string, personName: string) {
        onDisputeSubject(personId, personName);
        setCommentsOpen(true);
    }

    return (
        <SubjectsQueryProvider>
            <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-amber-900 hover:bg-amber-50"
                onClick={() => setPeopleOpen((v) => !v)}
            >
                People
                {peopleOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            {peopleOpen && <SubjectsPanel photoId={photoId} isAdmin={isAdmin} onDisputeSubject={handleDisputeSubject} />}

            <button
                type="button"
                className="flex w-full items-center justify-between border-t border-amber-200 px-4 py-2.5 text-left text-sm font-semibold text-amber-900 hover:bg-amber-50"
                onClick={() => setCommentsOpen((v) => !v)}
            >
                Comments
                {commentsOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            {commentsOpen && (
                <CommentPanel
                    photoId={photoId}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    initialBody={initialBody}
                    onCommentPosted={onCommentPosted}
                />
            )}
        </SubjectsQueryProvider>
    );
}
