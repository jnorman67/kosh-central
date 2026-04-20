import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LibraryBig } from 'lucide-react';

interface BrandMarkProps {
    onClick?: () => void;
    title?: string;
}

export function BrandMark({ onClick, title = 'Home' }: BrandMarkProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onClick} aria-label={title}>
                    <LibraryBig className="h-4 w-4 text-amber-600" />
                    <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-base font-semibold tracking-tight text-transparent">
                        Kosh Central
                    </span>
                </Button>
            </TooltipTrigger>
            <TooltipContent>{title}</TooltipContent>
        </Tooltip>
    );
}
