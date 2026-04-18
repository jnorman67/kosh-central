import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { BackThumbnail } from '@/app/features/photos/components/back-thumbnail';
import { FolderSelector } from '@/app/features/photos/components/folder-selector';
import { LetterboxViewer } from '@/app/features/photos/components/letterbox-viewer';
import { PhotoControls } from '@/app/features/photos/components/photo-controls';
import { PhotoGallery } from '@/app/features/photos/components/photo-gallery';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { useViewerState } from '@/app/features/photos/hooks/use-viewer-state';
import type { Photo } from '@/app/features/photos/models/photos.models';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { Button } from '@/components/ui/button';
import { LayoutGrid } from 'lucide-react';
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
    const { currentFolderIndex, currentPhotoIndex, view, setFolder, openPhoto, backToGallery, nextPhoto, prevPhoto } = useViewerState();
    const { data: me } = useGetMe();
    const logout = useLogout();
    const [backEnlarged, setBackEnlarged] = useState(false);

    const { data: folders = [], isLoading: foldersLoading } = useGetFolders();

    // If a saved folder index is out of range (config shrank/changed), fall back to 0.
    useEffect(() => {
        if (folders.length > 0 && currentFolderIndex >= folders.length) {
            setFolder(0);
        }
    }, [folders.length, currentFolderIndex, setFolder]);

    const currentFolder = folders[currentFolderIndex];
    const { data: allPhotos = [], isLoading: photosLoading } = useGetPhotos(currentFolder?.id ?? null);

    // Hide photos that are the back of another — they should only appear as the side thumbnail.
    const viewablePhotos = useMemo(() => allPhotos.filter((p) => !p.relations?.some((r) => r.relationType === 'back-of')), [allPhotos]);

    const currentPhoto = viewablePhotos[currentPhotoIndex] ?? null;
    const back = currentPhoto ? findBackFor(currentPhoto, allPhotos) : null;

    // Reset the enlargement whenever the current photo changes.
    useEffect(() => {
        setBackEnlarged(false);
    }, [currentPhoto?.id]);

    // Allow Escape to cancel back-enlargement or return to the gallery.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key !== 'Escape') return;
            if (backEnlarged) setBackEnlarged(false);
            else if (view === 'photo') backToGallery();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [backEnlarged, view, backToGallery]);

    const handleNext = useCallback(() => nextPhoto(viewablePhotos.length), [nextPhoto, viewablePhotos.length]);
    const handlePrev = useCallback(() => prevPhoto(viewablePhotos.length), [prevPhoto, viewablePhotos.length]);

    function handleLogout() {
        logout.mutate(undefined, {
            onSuccess: () => navigate('/login', { replace: true }),
        });
    }

    const displayPhoto = backEnlarged && back ? back : currentPhoto;
    const isGallery = view === 'gallery';

    return (
        <>
            {/* Preload next 2 photos when viewing a single photo */}
            {!isGallery &&
                viewablePhotos
                    .slice(currentPhotoIndex + 1, currentPhotoIndex + 3)
                    .map((p) => <link key={p.id} rel="preload" as="image" href={p.downloadUrl} />)}

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
                            {!isGallery && (
                                <Button variant="ghost" size="sm" onClick={backToGallery}>
                                    <LayoutGrid className="mr-2 h-4 w-4" />
                                    Gallery
                                </Button>
                            )}
                            <span className="text-sm text-muted-foreground">{me?.displayName}</span>
                            <Button variant="ghost" size="sm" onClick={handleLogout}>
                                Sign out
                            </Button>
                        </div>
                    </div>
                }
                viewer={
                    isGallery ? (
                        <PhotoGallery photos={viewablePhotos} isLoading={photosLoading && !!currentFolder} onSelect={openPhoto} />
                    ) : (
                        <LetterboxViewer
                            photo={displayPhoto}
                            isLoading={photosLoading && !!currentFolder}
                            onClick={backEnlarged ? () => setBackEnlarged(false) : undefined}
                        />
                    )
                }
                rightPanel={
                    !isGallery && back && !backEnlarged ? <BackThumbnail back={back} onClick={() => setBackEnlarged(true)} /> : undefined
                }
                toolbar={
                    isGallery ? (
                        <div className="flex items-center justify-center px-4 py-2 text-sm text-muted-foreground">
                            {viewablePhotos.length} {viewablePhotos.length === 1 ? 'photo' : 'photos'}
                        </div>
                    ) : (
                        <PhotoControls
                            currentIndex={currentPhotoIndex}
                            totalCount={viewablePhotos.length}
                            onPrev={handlePrev}
                            onNext={handleNext}
                        />
                    )
                }
            />
        </>
    );
}
