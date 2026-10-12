import { CommentPanel } from '@/app/features/comments/components/comment-panel';
import { useCommentsQueries } from '@/app/features/comments/contexts/comments-query.context';
import { OcrPanel } from '@/app/features/ocr/components/ocr-panel';
import { OcrQueryProvider } from '@/app/features/ocr/contexts/ocr-query.context';
import { SubjectsQueryProvider, useSubjectsQueries } from '@/app/features/photos/contexts/subjects-query.context';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { SubjectsPanel } from './subjects-panel';

interface MobilePanelProps {
    photoId: string;
    bundleId?: string | null;
    currentUserId: string;
    isAdmin: boolean;
    initialBody?: string;
    onCommentPosted?: () => void;
    onDisputeSubject: (personId: string, personName: string) => void;
}

export function MobilePanel(props: MobilePanelProps) {
    return (
        <SubjectsQueryProvider>
            <MobilePanelSections {...props} />
        </SubjectsQueryProvider>
    );
}

function MobilePanelSections({
    photoId,
    bundleId,
    currentUserId,
    isAdmin,
    initialBody,
    onCommentPosted,
    onDisputeSubject,
}: MobilePanelProps) {
    const [peopleOpen, setPeopleOpen] = useState(false);
    const [commentsOpen, setCommentsOpen] = useState(false);
    // The collapsed rows say who is tagged and how many comments there are, so nobody has to open
    // them to find out. The panels below share these queries' cache.
    const { usePhotoSubjects } = useSubjectsQueries();
    const { useGetComments } = useCommentsQueries();
    const { data: subjects = [] } = usePhotoSubjects(photoId);
    const { data: comments = [] } = useGetComments(photoId);

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
        <>
            <SectionToggle label="People" open={peopleOpen} onToggle={() => setPeopleOpen((v) => !v)}>
                {subjects.length > 0 && (
                    <span className="truncate font-normal text-muted-foreground">{subjects.map((s) => s.fullName).join(', ')}</span>
                )}
            </SectionToggle>
            {peopleOpen && (
                <SubjectsPanel
                    photoId={photoId}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onDisputeSubject={handleDisputeSubject}
                    hideHeading
                />
            )}

            <SectionToggle
                label="Comments"
                open={commentsOpen}
                onToggle={() => setCommentsOpen((v) => !v)}
                className="border-t border-amber-200"
            >
                {comments.length > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{comments.length}</span>
                )}
            </SectionToggle>
            {commentsOpen && (
                <CommentPanel
                    photoId={photoId}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    initialBody={initialBody}
                    onCommentPosted={onCommentPosted}
                    hideHeading
                />
            )}

            {bundleId && (
                <OcrQueryProvider>
                    <OcrPanel bundleId={bundleId} isAdmin={isAdmin} className="border-t border-amber-200" />
                </OcrQueryProvider>
            )}
        </>
    );
}

interface SectionToggleProps {
    label: string;
    open: boolean;
    onToggle: () => void;
    /** What the section holds, shown while it's collapsed. */
    children?: ReactNode;
    className?: string;
}

function SectionToggle({ label, open, onToggle, children, className }: SectionToggleProps) {
    const Chevron = open ? ChevronUp : ChevronDown;
    return (
        <button
            type="button"
            aria-expanded={open}
            className={cn(
                'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-amber-900 hover:bg-amber-50',
                className,
            )}
            onClick={onToggle}
        >
            <span className="shrink-0">{label}</span>
            <span className="flex min-w-0 flex-1 items-center">{!open && children}</span>
            <Chevron className="h-4 w-4 shrink-0" />
        </button>
    );
}
