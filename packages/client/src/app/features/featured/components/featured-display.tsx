import { DEFAULT_BUTTON_LABEL, FEATURED_THEMES } from '@/app/features/featured/lib/featured-themes';
import type { FeaturedContent } from '@/app/features/featured/models/featured.models';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

interface FeaturedDisplayProps {
    content: FeaturedContent;
    imageUrl: string | null;
    imageAlt: string;
    /** Called when the photo is clicked; omit to make the photo inert. */
    onOpenPhoto?: () => void;
    onViewAlbum?: () => void;
    onContinue?: () => void;
    /** Scaled-down rendering for the admin preview pane. Buttons are inert. */
    compact?: boolean;
    className?: string;
}

/** Themed presentation of a featured album. Shared by the real page and the admin preview. */
export function FeaturedDisplay({
    content,
    imageUrl,
    imageAlt,
    onOpenPhoto,
    onViewAlbum,
    onContinue,
    compact = false,
    className,
}: FeaturedDisplayProps) {
    const theme = FEATURED_THEMES[content.theme];
    const c = theme.classes;
    const Ornament = theme.ornament;

    const image = imageUrl ? (
        <img src={imageUrl} alt={imageAlt} className={cn('block max-w-full object-contain', compact ? 'max-h-56' : 'max-h-[55vh]')} />
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
                            onClick={onOpenPhoto}
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
