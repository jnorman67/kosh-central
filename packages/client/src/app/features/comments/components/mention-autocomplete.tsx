import type { MentionCandidate } from '../models/comments.models';

interface MentionAutocompleteProps {
    candidates: MentionCandidate[];
    activeIndex: number;
    onSelect: (candidate: MentionCandidate) => void;
    onActiveIndexChange: (index: number) => void;
}

export function MentionAutocomplete({ candidates, activeIndex, onSelect, onActiveIndexChange }: MentionAutocompleteProps) {
    if (candidates.length === 0) return null;

    return (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-md border border-amber-200 bg-white shadow-md">
            {candidates.slice(0, 8).map((c, i) => (
                <button
                    key={`${c.type}:${c.id}`}
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50 ${
                        i === activeIndex ? 'bg-amber-50' : ''
                    }`}
                    onMouseEnter={() => onActiveIndexChange(i)}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        onSelect(c);
                    }}
                >
                    <span className="shrink-0 text-xs text-muted-foreground">{c.type === 'user' ? '@' : '★'}</span>
                    <span className="truncate">{c.displayLabel}</span>
                </button>
            ))}
        </div>
    );
}
