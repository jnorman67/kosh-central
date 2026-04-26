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
        <div className="absolute bottom-full left-0 z-50 mb-1 w-72 overflow-hidden rounded-md border border-amber-200 bg-white shadow-md">
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
                    {c.type === 'user' ? (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
                            User
                        </span>
                    ) : (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800">
                            Person
                        </span>
                    )}
                    <div className="min-w-0">
                        <div className="truncate">{c.displayLabel}</div>
                        {c.nickname && (
                            <div className="truncate text-xs text-muted-foreground">"{c.nickname}"</div>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
}
