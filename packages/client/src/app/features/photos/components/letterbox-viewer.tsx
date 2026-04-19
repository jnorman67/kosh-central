import type { Photo } from '@/app/features/photos/models/photos.models';
import { useEffect, useState } from 'react';

interface LetterboxViewerProps {
    photo: Photo | null;
    isLoading: boolean;
    /** If provided, the image becomes clickable (e.g. to cancel back-enlargement). */
    onClick?: () => void;
}

export function LetterboxViewer({ photo, isLoading, onClick }: LetterboxViewerProps) {
    const [imgLoaded, setImgLoaded] = useState(false);

    useEffect(() => {
        setImgLoaded(false);
    }, [photo?.downloadUrl]);

    const clickable = !!onClick;
    const showSpinner = isLoading || (!!photo && !imgLoaded);

    return (
        <div
            className={`relative flex h-full w-full items-center justify-center bg-black ${clickable ? 'cursor-zoom-out' : ''}`}
            onClick={onClick}
        >
            {photo && (
                <img
                    src={photo.downloadUrl}
                    alt={photo.name}
                    onLoad={() => setImgLoaded(true)}
                    className={`max-h-full max-w-full object-contain transition-opacity duration-150 ${imgLoaded ? 'opacity-100' : 'opacity-40'}`}
                />
            )}
            {!photo && !isLoading && <div className="text-zinc-500">No photo selected</div>}
            {showSpinner && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200" />
                </div>
            )}
        </div>
    );
}
