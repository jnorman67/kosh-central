import { Button } from '@/components/ui/button';
import { useRef, useState } from 'react';
import { useMentionCandidates } from '../hooks/use-mention-candidates';
import type { MentionCandidate, MentionInput } from '../models/comments.models';
import { MentionAutocomplete } from './mention-autocomplete';

const MENTION_TRIGGER_RE = /(^|\s)@(\w*)$/;

interface CommentFormProps {
    photoId: string;
    initialBody?: string;
    initialMentions?: MentionInput[];
    onSubmit: (body: string, mentions: MentionInput[]) => void;
    onCancel?: () => void;
    isSubmitting?: boolean;
    submitLabel?: string;
}

export function CommentForm({
    photoId: _photoId,
    initialBody = '',
    initialMentions = [],
    onSubmit,
    onCancel,
    isSubmitting = false,
    submitLabel = 'Post',
}: CommentFormProps) {
    const [body, setBody] = useState(initialBody);
    const [mentions, setMentions] = useState<MentionInput[]>(initialMentions);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const candidates = useMentionCandidates();

    function handleChange(value: string) {
        setBody(value);

        const ta = textareaRef.current;
        if (!ta) return;
        const textUpToCaret = value.slice(0, ta.selectionStart ?? value.length);
        const match = MENTION_TRIGGER_RE.exec(textUpToCaret);
        if (match) {
            setMentionQuery(match[2]);
        } else {
            setMentionQuery(null);
        }
    }

    function handleMentionSelect(candidate: MentionCandidate) {
        const ta = textareaRef.current;
        if (!ta) return;
        const caret = ta.selectionStart ?? body.length;
        const textUpToCaret = body.slice(0, caret);
        const match = MENTION_TRIGGER_RE.exec(textUpToCaret);
        if (!match) return;

        const prefix = textUpToCaret.slice(0, match.index + match[1].length);
        const suffix = body.slice(caret);
        const insertion = `@[${candidate.insertLabel}](${candidate.type}:${candidate.id})`;
        const newBody = prefix + insertion + (suffix.startsWith(' ') ? suffix : ' ' + suffix);

        setBody(newBody);
        setMentions((prev) => {
            const exists = prev.some((m) => m.mentionType === candidate.type && m.mentionedId === candidate.id);
            if (exists) return prev;
            return [...prev, { mentionType: candidate.type, mentionedId: candidate.id }];
        });
        setMentionQuery(null);

        requestAnimationFrame(() => {
            const newCaret = prefix.length + insertion.length + 1;
            ta.focus();
            ta.setSelectionRange(newCaret, newCaret);
        });
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!body.trim() || isSubmitting) return;
        onSubmit(body.trim(), mentions);
        if (!initialBody) {
            setBody('');
            setMentions([]);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder="Add a comment… (type @ to mention)"
                    rows={3}
                    disabled={isSubmitting}
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                />
                {mentionQuery !== null && (
                    <MentionAutocomplete
                        query={mentionQuery}
                        candidates={candidates}
                        onSelect={handleMentionSelect}
                        onClose={() => setMentionQuery(null)}
                        anchorEl={textareaRef.current}
                    />
                )}
            </div>
            <div className="flex justify-end gap-2">
                {onCancel && (
                    <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" size="sm" disabled={!body.trim() || isSubmitting}>
                    {isSubmitting ? 'Saving…' : submitLabel}
                </Button>
            </div>
        </form>
    );
}
