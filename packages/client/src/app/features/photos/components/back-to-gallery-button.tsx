import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft } from 'lucide-react';

interface BackToGalleryButtonProps {
    onClick: () => void;
    /** What the user returns to, e.g. "gallery", "pages", "favorites". */
    target?: string;
}

// Prominent, always-labelled way out of single-photo view. Sits at the left of
// the header where users look for "back", and advertises the Esc shortcut.
export function BackToGalleryButton({ onClick, target = 'gallery' }: BackToGalleryButtonProps) {
    const shortLabel = target.charAt(0).toUpperCase() + target.slice(1);
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onClick}
                    aria-label={`Back to ${target}`}
                    className="min-w-0 max-w-[40vw] shrink-0 border-amber-300 text-sm font-semibold text-amber-900 hover:bg-amber-50 hover:text-amber-950"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="truncate sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">Back to {target}</span>
                </Button>
            </TooltipTrigger>
            <TooltipContent>Back to {target} (Esc)</TooltipContent>
        </Tooltip>
    );
}
