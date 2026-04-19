import type { Photo } from '@/app/features/photos/models/photos.models';

interface LetterboxViewerProps {
    photo: Photo | null;
    isLoading: boolean;
    /** If provided, the image becomes clickable (e.g. to cancel back-enlargement). */
    onClick?: () => void;
}

export function LetterboxViewer({ photo, isLoading, onClick }: LetterboxViewerProps) {
    const clickable = !!onClick;
    return (
        <div className={`flex h-full w-full items-center justify-center bg-black ${clickable ? 'cursor-zoom-out' : ''}`} onClick={onClick}>
            {isLoading ? (
                <div className="text-zinc-500">Loading...</div>
            ) : photo ? (
                <img src={photo.downloadUrl} alt={photo.name} className="max-h-full max-w-full object-contain" />
            ) : (
                <div className="text-zinc-500">No photo selected</div>
            )}
        </div>
    );
}
