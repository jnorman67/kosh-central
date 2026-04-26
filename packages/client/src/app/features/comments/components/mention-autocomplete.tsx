import { useState } from 'react';
import type { MentionCandidate } from '../models/comments.models';

interface MentionAutocompleteProps {
    candidates: MentionCandidate[];
    activeIndex: number;
    onSelect: (candidate: MentionCandidate) => void;
    onActiveIndexChange: (index: number) => void;
}

function disambiguationLine(c: MentionCandidate): string | null {
    if (c.type !== 'person') return null;

    const birthYear = c.birthYear ?? c.birthDate?.match(/\b(\d{4})\b/)?.[1] ?? null;
    const deathYear = c.deathDate?.match(/\b(\d{4})\b/)?.[1] ?? null;

    const parts: string[] = [];
    if (birthYear || deathYear) {
        parts.push(deathYear ? `${birthYear ?? '?'} – ${deathYear}` : `b. ${birthYear}`);
    }
    if (c.birthPlace) parts.push(c.birthPlace);

    if (parts.length > 0) return parts.join(' · ');
    return null;
}

function PersonAvatar({ candidate }: { candidate: MentionCandidate }) {
    const [imgFailed, setImgFailed] = useState(false);
    const initials = candidate.displayLabel
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');

    if (candidate.portraitThumbUrl && !imgFailed) {
        return (
            <img
                src={candidate.portraitThumbUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded object-cover"
                onError={() => setImgFailed(true)}
            />
        );
    }

    return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-amber-100 text-xs font-semibold text-amber-800">
            {initials || '?'}
        </span>
    );
}

export function MentionAutocomplete({ candidates, activeIndex, onSelect, onActiveIndexChange }: MentionAutocompleteProps) {
    if (candidates.length === 0) return null;

    return (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-80 overflow-hidden rounded-md border border-amber-200 bg-white shadow-md">
            {candidates.slice(0, 8).map((c, i) => {
                const dis = disambiguationLine(c);
                return (
                    <button
                        key={`${c.type}:${c.id}`}
                        type="button"
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-amber-50 ${
                            i === activeIndex ? 'bg-amber-50' : ''
                        }`}
                        onMouseEnter={() => onActiveIndexChange(i)}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelect(c);
                        }}
                    >
                        {c.type === 'person' ? (
                            <PersonAvatar candidate={c} />
                        ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-100 text-xs font-semibold text-blue-700">
                                U
                            </span>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1.5">
                                <span className="truncate font-medium">{c.displayLabel}</span>
                                {c.type === 'user' && (
                                    <span className="shrink-0 rounded px-1 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
                                        User
                                    </span>
                                )}
                            </div>
                            {c.nickname && (
                                <div className="truncate text-xs text-muted-foreground">"{c.nickname}"</div>
                            )}
                            {dis && (
                                <div className="truncate text-xs text-muted-foreground">{dis}</div>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
