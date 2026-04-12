import type { Photo } from '@/app/features/photos/models/photos.models';

interface LetterboxViewerProps {
    photo: Photo | null;
    isLoading: boolean;
}

export function LetterboxViewer({ photo, isLoading }: LetterboxViewerProps) {
    return (
        <div className="flex h-full w-full items-center justify-center bg-black">
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
