import type { Photo } from '@/app/features/photos/models/photos.models';

interface RelatedStripItem {
    photo: Photo;
    label: string;
}

interface RelatedStripProps {
    mainPhoto: Photo;
    related: RelatedStripItem[];
    selectedId: string | null;
    onSelectRelated: (photoId: string) => void;
    onBackToMain: () => void;
    className?: string;
}

export function RelatedStrip({ mainPhoto, related, selectedId, onSelectRelated, onBackToMain, className }: RelatedStripProps) {
    if (related.length === 0) return null;
    const isMainSelected = selectedId === mainPhoto.id || selectedId === null;

    return (
        <div className={`pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-2 ${className ?? ''}`}>
            <div className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full bg-black/60 p-1 backdrop-blur-sm">
                <Thumb photo={mainPhoto} label="Main" selected={isMainSelected} onClick={onBackToMain} />
                {related.map((r) => (
                    <Thumb
                        key={r.photo.id}
                        photo={r.photo}
                        label={r.label}
                        selected={selectedId === r.photo.id}
                        onClick={() => onSelectRelated(r.photo.id)}
                    />
                ))}
            </div>
        </div>
    );
}

interface ThumbProps {
    photo: Photo;
    label: string;
    selected: boolean;
    onClick: () => void;
}

function Thumb({ photo, label, selected, onClick }: ThumbProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-current={selected}
            className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 transition ${
                selected ? 'opacity-100 ring-white' : 'opacity-60 ring-transparent'
            }`}
        >
            <img src={photo.thumbnailUrl ?? photo.downloadUrl} alt="" className="h-full w-full object-cover" />
        </button>
    );
}
