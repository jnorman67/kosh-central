import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { FolderSelector } from '@/app/features/photos/components/folder-selector';
import { LetterboxViewer } from '@/app/features/photos/components/letterbox-viewer';
import { PhotoControls } from '@/app/features/photos/components/photo-controls';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { useViewerState } from '@/app/features/photos/hooks/use-viewer-state';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { Button } from '@/components/ui/button';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function ViewerPage() {
    const navigate = useNavigate();
    const { useGetFolders, useGetPhotos } = usePhotosQueries();
    const { useGetMe, useLogout } = useAuthQueries();
    const { currentFolderIndex, currentPhotoIndex, setFolder, nextPhoto, prevPhoto } = useViewerState();
    const { data: me } = useGetMe();
    const logout = useLogout();

    const { data: folders = [], isLoading: foldersLoading } = useGetFolders();
    const currentFolder = folders[currentFolderIndex];
    const { data: photos = [], isLoading: photosLoading } = useGetPhotos(currentFolder?.id ?? null);

    const currentPhoto = photos[currentPhotoIndex] ?? null;

    const handleNext = useCallback(() => nextPhoto(photos.length), [nextPhoto, photos.length]);
    const handlePrev = useCallback(() => prevPhoto(photos.length), [prevPhoto, photos.length]);

    function handleLogout() {
        logout.mutate(undefined, {
            onSuccess: () => navigate('/login', { replace: true }),
        });
    }

    return (
        <>
            {/* Preload next 2 photos */}
            {photos.slice(currentPhotoIndex + 1, currentPhotoIndex + 3).map((p) => (
                <link key={p.id} rel="preload" as="image" href={p.downloadUrl} />
            ))}

            <ViewerLayout
                header={
                    <div className="flex items-center justify-between">
                        <FolderSelector
                            folders={folders}
                            selectedIndex={currentFolderIndex}
                            onSelect={setFolder}
                            isLoading={foldersLoading}
                        />
                        <div className="flex items-center gap-3 px-4">
                            <span className="text-sm text-muted-foreground">{me?.displayName}</span>
                            <Button variant="ghost" size="sm" onClick={handleLogout}>
                                Sign out
                            </Button>
                        </div>
                    </div>
                }
                viewer={<LetterboxViewer photo={currentPhoto} isLoading={photosLoading && !!currentFolder} />}
                toolbar={
                    <PhotoControls currentIndex={currentPhotoIndex} totalCount={photos.length} onPrev={handlePrev} onNext={handleNext} />
                }
            />
        </>
    );
}
