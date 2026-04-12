import { FolderSelector } from '@/app/features/photos/components/folder-selector';
import { LetterboxViewer } from '@/app/features/photos/components/letterbox-viewer';
import { PhotoControls } from '@/app/features/photos/components/photo-controls';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { useViewerState } from '@/app/features/photos/hooks/use-viewer-state';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { useCallback } from 'react';

export function ViewerPage() {
    const { useGetFolders, useGetPhotos } = usePhotosQueries();
    const { currentFolderIndex, currentPhotoIndex, setFolder, nextPhoto, prevPhoto } = useViewerState();

    const { data: folders = [], isLoading: foldersLoading } = useGetFolders();
    const currentFolder = folders[currentFolderIndex];
    const { data: photos = [], isLoading: photosLoading } = useGetPhotos(currentFolder?.id ?? null);

    const currentPhoto = photos[currentPhotoIndex] ?? null;

    const handleNext = useCallback(() => nextPhoto(photos.length), [nextPhoto, photos.length]);
    const handlePrev = useCallback(() => prevPhoto(photos.length), [prevPhoto, photos.length]);

    return (
        <>
            {/* Preload next 2 photos */}
            {photos.slice(currentPhotoIndex + 1, currentPhotoIndex + 3).map((p) => (
                <link key={p.id} rel="preload" as="image" href={p.downloadUrl} />
            ))}

            <ViewerLayout
                header={
                    <FolderSelector folders={folders} selectedIndex={currentFolderIndex} onSelect={setFolder} isLoading={foldersLoading} />
                }
                viewer={<LetterboxViewer photo={currentPhoto} isLoading={photosLoading && !!currentFolder} />}
                toolbar={
                    <PhotoControls currentIndex={currentPhotoIndex} totalCount={photos.length} onPrev={handlePrev} onNext={handleNext} />
                }
            />
        </>
    );
}
