import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { BackThumbnail } from '@/app/features/photos/components/back-thumbnail';
import { FolderSelector } from '@/app/features/photos/components/folder-selector';
import { LetterboxViewer } from '@/app/features/photos/components/letterbox-viewer';
import { PhotoControls } from '@/app/features/photos/components/photo-controls';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { useViewerState } from '@/app/features/photos/hooks/use-viewer-state';
import type { Photo } from '@/app/features/photos/models/photos.models';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** Find the back photo (if any) for the given front. The front has a 'front-of' relation pointing to its back's catalog id. */
function findBackFor(front: Photo, allPhotos: Photo[]): Photo | null {
    const frontOf = front.relations?.find((r) => r.relationType === 'front-of');
    if (!frontOf) return null;
    return allPhotos.find((p) => p.catalogId === frontOf.relatedPhotoId) ?? null;
}

export function ViewerPage() {
    const navigate = useNavigate();
    const { useGetFolders, useGetPhotos } = usePhotosQueries();
    const { useGetMe, useLogout } = useAuthQueries();
    const { currentFolderIndex, currentPhotoIndex, setFolder, nextPhoto, prevPhoto } = useViewerState();
    const { data: me } = useGetMe();
    const logout = useLogout();
    const [backEnlarged, setBackEnlarged] = useState(false);

    const { data: folders = [], isLoading: foldersLoading } = useGetFolders();
    const currentFolder = folders[currentFolderIndex];
    const { data: allPhotos = [], isLoading: photosLoading } = useGetPhotos(currentFolder?.id ?? null);

    // Hide photos that are the back of another — they should only appear as the side thumbnail.
    const viewablePhotos = useMemo(
        () => allPhotos.filter((p) => !p.relations?.some((r) => r.relationType === 'back-of')),
        [allPhotos],
    );

    const currentPhoto = viewablePhotos[currentPhotoIndex] ?? null;
    const back = currentPhoto ? findBackFor(currentPhoto, allPhotos) : null;

    // Reset the enlargement whenever the current photo changes.
    useEffect(() => {
        setBackEnlarged(false);
    }, [currentPhoto?.id]);

    // Allow Escape to cancel enlargement.
    useEffect(() => {
        if (!backEnlarged) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setBackEnlarged(false);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [backEnlarged]);

    const handleNext = useCallback(() => nextPhoto(viewablePhotos.length), [nextPhoto, viewablePhotos.length]);
    const handlePrev = useCallback(() => prevPhoto(viewablePhotos.length), [prevPhoto, viewablePhotos.length]);

    function handleLogout() {
        logout.mutate(undefined, {
            onSuccess: () => navigate('/login', { replace: true }),
        });
    }

    const displayPhoto = backEnlarged && back ? back : currentPhoto;

    return (
        <>
            {/* Preload next 2 photos */}
            {viewablePhotos.slice(currentPhotoIndex + 1, currentPhotoIndex + 3).map((p) => (
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
                viewer={
                    <LetterboxViewer
                        photo={displayPhoto}
                        isLoading={photosLoading && !!currentFolder}
                        onClick={backEnlarged ? () => setBackEnlarged(false) : undefined}
                    />
                }
                rightPanel={
                    back && !backEnlarged ? <BackThumbnail back={back} onClick={() => setBackEnlarged(true)} /> : undefined
                }
                toolbar={
                    <PhotoControls
                        currentIndex={currentPhotoIndex}
                        totalCount={viewablePhotos.length}
                        onPrev={handlePrev}
                        onNext={handleNext}
                    />
                }
            />
        </>
    );
}
