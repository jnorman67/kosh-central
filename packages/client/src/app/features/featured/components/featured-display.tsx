import { DEFAULT_BUTTON_LABEL, FEATURED_THEMES } from '@/app/features/featured/lib/featured-themes';
import type { FeaturedContent } from '@/app/features/featured/models/featured.models';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

/** How long each photo stays up before the next fades in. */
const SLIDE_INTERVAL_MS = 7000;
/** The incoming photo's fade-in. */
const FADE_IN_MS = 2500;
/** The outgoing photo holds until the incoming one is mostly opaque, then fades out. */
const FADE_OUT_DELAY_MS = 1500;
const FADE_OUT_MS = 2000;

export interface FeaturedImage {
    url: string;
    alt: string;
}

interface FeaturedDisplayProps {
    content: FeaturedContent;
    /** Photos to show, featured photo first. More than one cycles slowly in a fixed-size frame. */
    images: FeaturedImage[];
    /** Called with the index of the photo that was clicked; omit to make the photo inert. */
    onOpenPhoto?: (index: number) => void;
    onViewAlbum?: () => void;
    onContinue?: () => void;
    /** Scaled-down rendering for the admin preview pane. Buttons are inert. */
    compact?: boolean;
    className?: string;
}

/** Themed presentation of a featured album. Shared by the real page and the admin preview. */
export function FeaturedDisplay({
    content,
    images,
    onOpenPhoto,
    onViewAlbum,
    onContinue,
    compact = false,
    className,
}: FeaturedDisplayProps) {
    const theme = FEATURED_THEMES[content.theme];
    const c = theme.classes;
    const Ornament = theme.ornament;

    const single = images.length === 1 ? images[0] : null;
    const image = single ? (
        <img src={single.url} alt={single.alt} className={cn('block max-w-full object-contain', compact ? 'max-h-56' : 'max-h-[55vh]')} />
    ) : null;

    return (
        <div
            className={cn(
                'flex w-full flex-col items-center justify-center text-center',
                compact ? 'gap-4 px-4 py-8' : 'min-h-screen gap-6 px-6 py-12',
                c.page,
                className,
            )}
        >
            {image && (
                <div className={cn('max-w-full', c.frame)}>
                    {onOpenPhoto ? (
                        <button
                            type="button"
                            onClick={() => onOpenPhoto(0)}
                            className="block transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Open this photo in the album"
                        >
                            {image}
                        </button>
                    ) : (
                        image
                    )}
                </div>
            )}
            {images.length > 1 && (
                <div className={cn('max-w-full', c.frame)}>
                    <FeaturedSlideshow images={images} onOpenPhoto={onOpenPhoto} compact={compact} />
                </div>
            )}

            <div className={cn('flex max-w-2xl flex-col items-center', compact ? 'gap-1.5' : 'gap-2')}>
                {content.eyebrow && <p className={c.eyebrow}>{content.eyebrow}</p>}
                {content.title && (
                    <h1 className={cn('text-balance leading-tight', compact ? 'text-2xl' : 'text-4xl sm:text-5xl', c.title)}>
                        {content.title}
                    </h1>
                )}
                {content.subtitle && <p className={cn(compact ? 'text-sm' : 'text-lg', c.subtitle)}>{content.subtitle}</p>}
            </div>

            <div className="flex items-center gap-3" aria-hidden="true">
                <span className={cn('h-px', compact ? 'w-10' : 'w-16', c.rule)} />
                {Ornament &&
                    (typeof Ornament === 'string' ? (
                        <span className={cn(compact ? 'text-lg' : 'text-2xl', c.ornament)}>{Ornament}</span>
                    ) : (
                        <Ornament className={cn(compact ? 'h-4 w-4' : 'h-5 w-5', c.ornament)} />
                    ))}
                <span className={cn('h-px', compact ? 'w-10' : 'w-16', c.rule)} />
            </div>

            {content.message && (
                <p
                    className={cn(
                        'max-w-prose whitespace-pre-line leading-relaxed',
                        compact ? 'text-sm' : 'text-base sm:text-lg',
                        c.message,
                    )}
                >
                    {content.message}
                </p>
            )}

            <div className={cn('flex flex-wrap items-center justify-center gap-2', compact && 'pointer-events-none')}>
                <Button
                    variant="ghost"
                    size={compact ? 'sm' : 'lg'}
                    onClick={onViewAlbum}
                    tabIndex={compact ? -1 : undefined}
                    className={c.primaryButton}
                >
                    {content.buttonLabel || DEFAULT_BUTTON_LABEL}
                    <ArrowRight />
                </Button>
                <Button
                    variant="ghost"
                    size={compact ? 'sm' : 'lg'}
                    onClick={onContinue}
                    tabIndex={compact ? -1 : undefined}
                    className={c.secondaryButton}
                >
                    Continue to all albums
                </Button>
            </div>
        </div>
    );
}

/** Slowly crossfades through the photos inside a fixed-size box, so photos of different shapes
 *  never shift the text below. Only the previous, current, and next photos are mounted; the next
 *  one loads and decodes invisibly, and the show waits for it rather than fading into a
 *  half-loaded image or stalling on a large decode mid-fade.
 *
 *  The incoming photo fades in on top while the outgoing one holds fully opaque underneath, then
 *  fades out late (it only shows where the new photo's letterboxing leaves gaps). Fading both at
 *  once would let the frame show through mid-transition as a visible dip. */
function FeaturedSlideshow({
    images,
    onOpenPhoto,
    compact,
}: {
    images: FeaturedImage[];
    onOpenPhoto?: (index: number) => void;
    compact: boolean;
}) {
    const [position, setPosition] = useState(0);
    const [loadedUrls, setLoadedUrls] = useState<ReadonlySet<string>>(() => new Set());

    // Refetches can change the list (fresh download URLs, edited album), so wrap rather than trust it.
    const current = position % images.length;
    const next = (current + 1) % images.length;
    const prev = (current - 1 + images.length) % images.length;
    const nextReady = loadedUrls.has(images[next].url);

    useEffect(() => {
        if (!nextReady) return;
        const id = setTimeout(() => setPosition(next), SLIDE_INTERVAL_MS);
        return () => clearTimeout(id);
    }, [next, nextReady]);

    // Timings are inline styles: tailwindcss-animate also claims `duration-*`/`delay-*`, which
    // makes arbitrary values like `duration-[2500ms]` ambiguous, so Tailwind emits nothing for them.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const transitionFor = (i: number) => {
        if (reduceMotion) return 'none';
        if (i === current) return `opacity ${FADE_IN_MS}ms ease-in-out`;
        if (i === prev) return `opacity ${FADE_OUT_MS}ms ease-in-out ${FADE_OUT_DELAY_MS}ms`;
        return 'none';
    };

    const markLoaded = (url: string) => setLoadedUrls((s) => (s.has(url) ? s : new Set(s).add(url)));

    const slides = [...new Set([prev, current, next])].map((i) => (
        <img
            key={i}
            src={images[i].url}
            alt={i === current ? images[i].alt : ''}
            aria-hidden={i !== current}
            draggable={false}
            decoding="async"
            onLoad={(e) => {
                const url = images[i].url;
                e.currentTarget.decode().then(
                    () => markLoaded(url),
                    () => markLoaded(url),
                );
            }}
            className={cn(
                'absolute inset-0 h-full w-full object-contain will-change-[opacity]',
                i === current ? 'z-10 opacity-100' : 'opacity-0',
            )}
            style={{ transition: transitionFor(i) }}
        />
    ));

    // Roughly 4:3, capped to the viewport width on narrow screens.
    const box = cn('relative block', compact ? 'h-56 w-[18.5rem] max-w-full' : 'h-[55vh] w-[min(calc(100vw-5rem),73vh)]');

    return onOpenPhoto ? (
        <button
            type="button"
            onClick={() => onOpenPhoto(current)}
            className={cn(
                box,
                'transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label="Open this photo in the album"
        >
            {slides}
        </button>
    ) : (
        <div className={box}>{slides}</div>
    );
}
