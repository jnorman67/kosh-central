import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LibraryBig } from 'lucide-react';

interface BrandMarkProps {
    onClick?: () => void;
    title?: string;
    /** Name the site on phones too, where the header has room for it (the album list). */
    showName?: boolean;
}

export function BrandMark({ onClick, title = 'Home', showName = false }: BrandMarkProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onClick} aria-label={title}>
                    <LibraryBig className="h-4 w-4 text-amber-600" />
                    <span
                        className={cn(
                            'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-base font-semibold tracking-tight text-transparent',
                            !showName && 'hidden sm:inline',
                        )}
                    >
                        Kosh Central
                    </span>
                </Button>
            </TooltipTrigger>
            <TooltipContent>{title}</TooltipContent>
        </Tooltip>
    );
}
