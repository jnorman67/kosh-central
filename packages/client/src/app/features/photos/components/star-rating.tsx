import { Star } from 'lucide-react';

interface StarRatingProps {
    /** 0–5, or null when uncataloged / unrated. */
    rating: number | null | undefined;
    /** Called with 1–5 when clicking a star. Clicking the currently-set rating clears it (passes 0). */
    onChange: (rating: number) => void;
    disabled?: boolean;
}

export function StarRating({ rating, onChange, disabled }: StarRatingProps) {
    const value = rating ?? 0;
    return (
        <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= value;
                return (
                    <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={n === value}
                        aria-label={`${n} star${n === 1 ? '' : 's'}`}
                        disabled={disabled}
                        onClick={() => onChange(n === value ? 0 : n)}
                        className="p-1 text-muted-foreground transition-colors hover:text-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Star className={`h-4 w-4 ${filled ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                    </button>
                );
            })}
        </div>
    );
}
