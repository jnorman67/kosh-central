import { useEffect, useRef, useState } from 'react';
import type { MentionCandidate } from '../models/comments.models';

interface MentionAutocompleteProps {
    query: string;
    candidates: MentionCandidate[];
    onSelect: (candidate: MentionCandidate) => void;
    onClose: () => void;
    anchorEl: HTMLTextAreaElement | null;
}

export function MentionAutocomplete({ query, candidates, onSelect, onClose, anchorEl }: MentionAutocompleteProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const filtered = candidates.filter((c) =>
        c.displayLabel.toLowerCase().includes(query.toLowerCase()),
    );

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered[activeIndex]) onSelect(filtered[activeIndex]);
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        anchorEl?.addEventListener('keydown', handler);
        return () => anchorEl?.removeEventListener('keydown', handler);
    }, [anchorEl, filtered, activeIndex, onSelect, onClose]);

    if (filtered.length === 0) return null;

    return (
        <div
            ref={listRef}
            className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-md border border-amber-200 bg-white shadow-md"
        >
            {filtered.slice(0, 8).map((c, i) => (
                <button
                    key={`${c.type}:${c.id}`}
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50 ${
                        i === activeIndex ? 'bg-amber-50' : ''
                    }`}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        onSelect(c);
                    }}
                >
                    <span className="shrink-0 text-xs text-muted-foreground">
                        {c.type === 'user' ? '@' : '★'}
                    </span>
                    <span className="truncate">{c.displayLabel}</span>
                </button>
            ))}
        </div>
    );
}
