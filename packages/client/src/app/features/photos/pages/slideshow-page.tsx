import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 50;
// Fetch the next page when we're this many photos from the end of what's loaded.
const PREFETCH_THRESHOLD = 5;
const SPEED_OPTIONS = [3, 4, 5, 7, 10] as const;
const DEFAULT_SPEED = 4;

export function SlideshowPage() {
    const navigate = useNavigate();
    const { useGetFavoritesInfinite } = usePhotosQueries();
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useGetFavoritesInfinite(PAGE_SIZE);

    const photos = useMemo(() => data?.pages.flatMap((p) => p.photos) ?? [], [data]);
    const total = data?.pages[0]?.total ?? 0;

    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);

    const current = photos[index] ?? null;

    // Load more pages as the slideshow approaches the end of what's loaded.
    useEffect(() => {
        if (!hasNextPage || isFetchingNextPage) return;
        if (photos.length > 0 && index >= photos.length - PREFETCH_THRESHOLD) {
            void fetchNextPage();
        }
    }, [index, photos.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const goNext = useCallback(() => {
        setIndex((i) => {
            if (photos.length === 0) return i;
            const next = i + 1;
            if (next < photos.length) return next;
            if (!hasNextPage) return 0;
            return i;
        });
    }, [photos.length, hasNextPage]);

    const goPrev = useCallback(() => {
        setIndex((i) => (i === 0 ? Math.max(0, photos.length - 1) : i - 1));
    }, [photos.length]);

    useEffect(() => {
        if (!playing || !current) return;
        const id = setTimeout(goNext, speed * 1000);
        return () => clearTimeout(id);
    }, [playing, speed, current, index, goNext]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') navigate('/favorites');
            else if (e.key === 'ArrowRight') goNext();
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === ' ') {
                e.preventDefault();
                setPlaying((p) => !p);
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [goNext, goPrev, navigate]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-black">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200" />
            </div>
        );
    }

    if (total === 0) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-black text-zinc-200">
                <p>No favorites to play.</p>
                <Button variant="secondary" onClick={() => navigate('/favorites')}>
                    Back to favorites
                </Button>
            </div>
        );
    }

    return (
        <div className="relative h-screen bg-black">
            {/* Warm the cache for upcoming photos so swaps are snappy. */}
            {photos.slice(index + 1, index + 4).map((p) => (
                <link key={p.id} rel="preload" as="image" href={p.downloadUrl} />
            ))}

            {current && (
                <img
                    src={current.downloadUrl}
                    alt={current.name}
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-contain select-none"
                />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-3 text-sm text-zinc-200">
                <span>{`${Math.min(index + 1, total)} of ${total}`}</span>
                <div className="pointer-events-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/favorites')}
                        className="text-zinc-200 hover:bg-white/10 hover:text-white"
                        title="Exit slideshow (Esc)"
                    >
                        <X className="h-4 w-4" />
                        Exit
                    </Button>
                </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 py-4 text-zinc-200">
                <div className="pointer-events-auto flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={goPrev}
                        className="text-zinc-200 hover:bg-white/10 hover:text-white"
                        title="Previous (←)"
                        aria-label="Previous"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPlaying((p) => !p)}
                        className="text-zinc-200 hover:bg-white/10 hover:text-white"
                        title={playing ? 'Pause (space)' : 'Play (space)'}
                        aria-label={playing ? 'Pause' : 'Play'}
                    >
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={goNext}
                        className="text-zinc-200 hover:bg-white/10 hover:text-white"
                        title="Next (→)"
                        aria-label="Next"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="mx-2 h-4 w-px bg-zinc-500" />
                    <label className="flex items-center gap-2 text-xs">
                        Speed
                        <select
                            value={speed}
                            onChange={(e) => setSpeed(Number(e.target.value))}
                            className="rounded border border-zinc-600 bg-black/50 px-2 py-1 text-xs text-zinc-200"
                        >
                            {SPEED_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                    {s}s
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>
        </div>
    );
}
