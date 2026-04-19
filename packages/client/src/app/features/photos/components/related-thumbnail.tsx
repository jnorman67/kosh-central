import type { Photo } from '@/app/features/photos/models/photos.models';

interface RelatedThumbnailProps {
    photo: Photo;
    label: string;
    onClick: () => void;
}

export function RelatedThumbnail({ photo, label, onClick }: RelatedThumbnailProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex w-full flex-col items-center gap-2 rounded-md border border-border bg-background p-2 transition hover:border-foreground/30"
        >
            <img
                src={photo.thumbnailUrl ?? photo.downloadUrl}
                alt={`${label} of ${photo.name}`}
                className="max-h-48 w-full object-contain"
            />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground group-hover:text-foreground">{label}</span>
        </button>
    );
}
