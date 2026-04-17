import type { Photo } from '@/app/features/photos/models/photos.models';

interface BackThumbnailProps {
    back: Photo;
    onClick: () => void;
}

export function BackThumbnail({ back, onClick }: BackThumbnailProps) {
    return (
        <div className="p-4">
            <button
                type="button"
                onClick={onClick}
                className="group flex w-full flex-col items-center gap-2 rounded-md border border-border bg-background p-2 transition hover:border-foreground/30"
            >
                <img
                    src={back.downloadUrl}
                    alt={`Back of ${back.name}`}
                    className="max-h-48 w-full object-contain"
                />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground group-hover:text-foreground">
                    Back
                </span>
            </button>
        </div>
    );
}
