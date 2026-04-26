import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMentionCandidates } from '../hooks/use-mention-candidates';
import type { MentionCandidate, MentionInput, MentionType } from '../models/comments.models';
import { MentionAutocomplete } from './mention-autocomplete';

const MENTION_TRIGGER_RE = /(^|\s)@([\w\s]*)$/;
const STORED_MENTION_RE = /@\[([^\]]+)\]\((user|person):([^)]+)\)/g;

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bodyToHTML(body: string): string {
    STORED_MENTION_RE.lastIndex = 0;
    let html = '';
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = STORED_MENTION_RE.exec(body)) !== null) {
        html += escapeHtml(body.slice(last, m.index));
        html += `<span contenteditable="false" data-mention-type="${m[2]}" data-mention-id="${escapeHtml(m[3])}" data-mention-label="${escapeHtml(m[1])}" class="font-medium text-amber-700 bg-amber-50 rounded px-0.5 select-none">@${escapeHtml(m[1])}</span>`;
        last = m.index + m[0].length;
    }
    html += escapeHtml(body.slice(last));
    return html;
}

function getEditorContent(editor: HTMLDivElement): { body: string; mentions: MentionInput[] } {
    const mentions: MentionInput[] = [];
    let body = '';

    function walk(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
            body += node.textContent ?? '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.dataset.mentionType && el.dataset.mentionId && el.dataset.mentionLabel) {
                body += `@[${el.dataset.mentionLabel}](${el.dataset.mentionType}:${el.dataset.mentionId})`;
                const type = el.dataset.mentionType as MentionType;
                const id = el.dataset.mentionId;
                if (!mentions.some((m) => m.mentionType === type && m.mentionedId === id)) {
                    mentions.push({ mentionType: type, mentionedId: id });
                }
            } else if (el.tagName === 'BR') {
                body += '\n';
            } else if (el.tagName === 'DIV') {
                if (body.length > 0) body += '\n';
                for (const child of el.childNodes) walk(child);
            } else {
                for (const child of el.childNodes) walk(child);
            }
        }
    }

    for (const child of editor.childNodes) walk(child);
    return { body: body.trim(), mentions };
}

function getTextUpToCaret(editor: HTMLDivElement): string {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return '';
    const range = sel.getRangeAt(0);
    let text = '';
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ALL);
    let node = walker.nextNode();
    while (node) {
        if (node === range.endContainer) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += (node.textContent ?? '').slice(0, range.endOffset);
            }
            break;
        }
        const parent = node instanceof Element ? node : node.parentElement;
        if (!parent?.dataset.mentionType && node.nodeType === Node.TEXT_NODE) {
            text += node.textContent ?? '';
        }
        node = walker.nextNode();
    }
    return text;
}

interface CommentFormProps {
    photoId: string;
    initialBody?: string;
    onSubmit: (body: string, mentions: MentionInput[]) => void;
    onCancel?: () => void;
    isSubmitting?: boolean;
    submitLabel?: string;
}

export function CommentForm({
    photoId: _photoId,
    initialBody = '',
    onSubmit,
    onCancel,
    isSubmitting = false,
    submitLabel = 'Post',
}: CommentFormProps) {
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isEmpty, setIsEmpty] = useState(!initialBody);
    const editorRef = useRef<HTMLDivElement>(null);
    const allCandidates = useMentionCandidates();

    const filteredCandidates = useMemo(() => {
        if (mentionQuery === null) return [];
        const q = mentionQuery.trimEnd().toLowerCase();
        const matches = allCandidates.filter((c) => c.displayLabel.toLowerCase().includes(q));
        matches.sort((a, b) => {
            const aStarts = a.displayLabel.toLowerCase().startsWith(q);
            const bStarts = b.displayLabel.toLowerCase().startsWith(q);
            if (aStarts !== bStarts) return aStarts ? -1 : 1;
            return a.displayLabel.localeCompare(b.displayLabel);
        });
        return matches.slice(0, 10);
    }, [mentionQuery, allCandidates]);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.innerHTML = initialBody ? bodyToHTML(initialBody) : '';
        setIsEmpty(!initialBody);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setActiveIndex(0);
    }, [mentionQuery]);

    function handleInput() {
        const editor = editorRef.current;
        if (!editor) return;
        const text = editor.textContent ?? '';
        setIsEmpty(text.trim().length === 0);
        const textUpToCaret = getTextUpToCaret(editor);
        const match = MENTION_TRIGGER_RE.exec(textUpToCaret);
        setMentionQuery(match ? match[2] : null);
    }

    function insertMention(candidate: MentionCandidate) {
        const editor = editorRef.current;
        const sel = window.getSelection();
        if (!editor || !sel || !sel.rangeCount) return;

        const textUpToCaret = getTextUpToCaret(editor);
        const match = MENTION_TRIGGER_RE.exec(textUpToCaret);
        if (!match) return;

        const range = sel.getRangeAt(0);
        const deleteLen = match[2].length + 1; // query + '@'
        const delRange = range.cloneRange();
        delRange.setStart(range.endContainer, range.endOffset - deleteLen);
        delRange.setEnd(range.endContainer, range.endOffset);
        delRange.deleteContents();

        const chip = document.createElement('span');
        chip.contentEditable = 'false';
        chip.dataset.mentionType = candidate.type;
        chip.dataset.mentionId = candidate.id;
        chip.dataset.mentionLabel = candidate.insertLabel;
        chip.className = 'font-medium text-amber-700 bg-amber-50 rounded px-0.5 select-none';
        chip.textContent = `@${candidate.insertLabel}`;

        const insertRange = sel.getRangeAt(0);
        insertRange.insertNode(chip);

        const space = document.createTextNode(' ');
        chip.after(space);
        const newRange = document.createRange();
        newRange.setStartAfter(space);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        setMentionQuery(null);
        setIsEmpty(false);
        editor.focus();
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (mentionQuery !== null && filteredCandidates.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, filteredCandidates.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                insertMention(filteredCandidates[activeIndex]);
                return;
            }
            if (e.key === 'Escape') {
                setMentionQuery(null);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitEditor();
        }
    }

    function submitEditor() {
        const editor = editorRef.current;
        if (!editor || isSubmitting) return;
        const { body, mentions } = getEditorContent(editor);
        if (!body) return;
        onSubmit(body, mentions);
        if (!initialBody) {
            editor.innerHTML = '';
            setIsEmpty(true);
        }
    }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                submitEditor();
            }}
            className="flex flex-col gap-2"
        >
            <div className="relative">
                <div
                    ref={editorRef}
                    contentEditable={!isSubmitting}
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    className="min-h-[4.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                />
                {isEmpty && (
                    <span className="pointer-events-none absolute left-3 top-2 select-none text-sm text-muted-foreground">
                        Add a comment… (type @ to mention)
                    </span>
                )}
                {mentionQuery !== null && filteredCandidates.length > 0 && (
                    <MentionAutocomplete
                        candidates={filteredCandidates}
                        activeIndex={activeIndex}
                        onSelect={insertMention}
                        onActiveIndexChange={setActiveIndex}
                    />
                )}
            </div>
            <div className="flex justify-end gap-2">
                {onCancel && (
                    <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" size="sm" disabled={isEmpty || isSubmitting}>
                    {isSubmitting ? 'Saving…' : submitLabel}
                </Button>
            </div>
        </form>
    );
}
