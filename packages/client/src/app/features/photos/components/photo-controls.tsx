import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';

interface PhotoControlsProps {
    currentIndex: number;
    totalCount: number;
    onPrev: () => void;
    onNext: () => void;
}

export function PhotoControls({ currentIndex, totalCount, onPrev, onNext }: PhotoControlsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                onPrev();
            } else if (e.key === 'ArrowRight') {
                onNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onPrev, onNext]);

    if (totalCount === 0) {
        return <div className="flex items-center justify-center px-4 py-2 text-sm text-muted-foreground">No photos</div>;
    }

    return (
        <div className="flex items-center justify-center gap-1 px-1 py-2 sm:gap-4 sm:px-4">
            <Button variant="ghost" size="icon" onClick={onPrev}>
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="min-w-[3rem] text-center text-sm text-muted-foreground sm:min-w-[5rem]">
                {currentIndex + 1} / {totalCount}
            </span>
            <Button variant="ghost" size="icon" onClick={onNext}>
                <ChevronRight className="h-5 w-5" />
            </Button>
        </div>
    );
}
