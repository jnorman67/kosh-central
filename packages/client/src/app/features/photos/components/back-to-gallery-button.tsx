import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

interface BackToGalleryButtonProps {
    onClick: () => void;
    /** What the user returns to, e.g. "gallery", "pages", "favorites". */
    target?: string;
    /** On phones the button doubles as the page title, naming where it returns to, e.g. the album. */
    title?: string;
    /** A line above the phone title, e.g. the album a subfolder belongs to. */
    caption?: string;
}

// Prominent, always-labelled way out of single-photo view. Sits at the left of
// the header where users look for "back", and advertises the Esc shortcut.
export function BackToGalleryButton({ onClick, target = 'gallery', title, caption }: BackToGalleryButtonProps) {
    const shortLabel = target.charAt(0).toUpperCase() + target.slice(1);
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onClick}
                    aria-label={`Back to ${target}`}
                    className={cn(
                        'min-w-0 shrink-0 border-amber-300 text-sm font-semibold text-amber-900 hover:bg-amber-50 hover:text-amber-950',
                        title
                            ? 'h-auto min-h-10 flex-1 justify-start border-0 bg-transparent px-2 py-1 text-left shadow-none sm:h-8 sm:min-h-0 sm:flex-none sm:border sm:bg-background sm:px-3 sm:py-0 sm:shadow-sm'
                            : 'max-w-[40vw]',
                    )}
                >
                    <ArrowLeft className="h-4 w-4" />
                    {title ? (
                        <span className="flex min-w-0 flex-col sm:hidden">
                            {caption && <span className="truncate text-xs font-medium text-muted-foreground">{caption}</span>}
                            <span
                                className={cn(
                                    'text-[15px] leading-tight text-amber-950',
                                    caption ? 'truncate' : 'line-clamp-2 whitespace-normal',
                                )}
                            >
                                {title}
                            </span>
                        </span>
                    ) : (
                        <span className="truncate sm:hidden">{shortLabel}</span>
                    )}
                    <span className="hidden sm:inline">Back to {target}</span>
                </Button>
            </TooltipTrigger>
            <TooltipContent>Back to {target} (Esc)</TooltipContent>
        </Tooltip>
    );
}
