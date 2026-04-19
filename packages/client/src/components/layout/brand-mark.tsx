import { Button } from '@/components/ui/button';
import { LibraryBig } from 'lucide-react';

interface BrandMarkProps {
    onClick?: () => void;
    title?: string;
}

export function BrandMark({ onClick, title = 'Home' }: BrandMarkProps) {
    return (
        <Button variant="ghost" size="sm" onClick={onClick} title={title} aria-label={title}>
            <LibraryBig className="h-4 w-4 text-amber-600" />
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-base font-semibold tracking-tight text-transparent">
                Kosh Central
            </span>
        </Button>
    );
}
