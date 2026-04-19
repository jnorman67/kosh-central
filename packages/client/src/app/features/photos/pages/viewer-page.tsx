import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { AlbumGallery } from '@/app/features/photos/components/album-gallery';
import { FolderSelector } from '@/app/features/photos/components/folder-selector';
import { LetterboxViewer } from '@/app/features/photos/components/letterbox-viewer';
import { PhotoControls } from '@/app/features/photos/components/photo-controls';
import { PhotoGallery } from '@/app/features/photos/components/photo-gallery';
import { RelatedThumbnail } from '@/app/features/photos/components/related-thumbnail';
import { StarRating } from '@/app/features/photos/components/star-rating';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { useViewerState } from '@/app/features/photos/hooks/use-viewer-state';
import type { Photo } from '@/app/features/photos/models/photos.models';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { Button } from '@/components/ui/button';
import { ExternalLink, Filter, Heart, LayoutGrid, LibraryBig, Star, StarOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface RelatedPhoto {
    photo: Photo;
    label: string;
}

/**
 * Collect the photos to show stacked on the side panel for the given main photo:
 * backs first (front-of relations), then raws (enhanced-version-of relations).
 */
function findRelatedPhotos(main: Photo, allPhotos: Photo[]): RelatedPhoto[] {
    const byCatalogId = new Map(allPhotos.filter((p) => p.catalogId).map((p) => [p.catalogId!, p]));
    const backs: RelatedPhoto[] = [];
    const raws: RelatedPhoto[] = [];
    for (const rel of main.relations ?? []) {
        const target = byCatalogId.get(rel.relatedPhotoId);
        if (!target) continue;
        if (rel.relationType === 'front-of') backs.push({ photo: target, label: 'Back' });
        else if (rel.relationType === 'enhanced-version-of') raws.push({ photo: target, label: 'Raw' });
    }
    return [...backs, ...raws];
}

export function ViewerPage() {
    const navigate = useNavigate();
    const { useGetFolders, useGetPhotos, useSetFolderCover, useClearFolderCover, useRatePhoto, useGetShareLink } = usePhotosQueries();
    const setCover = useSetFolderCover();
    const clearCover = useClearFolderCover();
    const ratePhoto = useRatePhoto();
    const { useGetMe, useLogout } = useAuthQueries();
    const { currentFolderIndex, currentPhotoIndex, view, setFolder, openPhoto, backToGallery, goToAlbums, nextPhoto, prevPhoto } =
        useViewerState();
    const { data: me } = useGetMe();
    const logout = useLogout();
    const [enlargedRelatedId, setEnlargedRelatedId] = useState<string | null>(null);
    const [uncatalogedOnly, setUncatalogedOnly] = useState(false);

    const { data: folders = [], isLoading: foldersLoading } = useGetFolders();

    // If a saved folder index is out of range (config shrank/changed), fall back to 0.
    useEffect(() => {
        if (folders.length > 0 && currentFolderIndex >= folders.length) {
            setFolder(0);
        }
    }, [folders.length, currentFolderIndex, setFolder]);

    const currentFolder = folders[currentFolderIndex];
    const { data: allPhotos = [], isLoading: photosLoading } = useGetPhotos(currentFolder?.id ?? null);

    // Hide photos that are a back or a raw — they only appear as side thumbnails.
    const viewablePhotos = useMemo(() => {
        if (uncatalogedOnly) return allPhotos.filter((p) => !p.catalogId);
        return allPhotos.filter((p) => !p.relations?.some((r) => r.relationType === 'back-of' || r.relationType === 'raw-version-of'));
    }, [allPhotos, uncatalogedOnly]);

    const uncatalogedCount = useMemo(() => allPhotos.filter((p) => !p.catalogId).length, [allPhotos]);

    // Reset the uncataloged filter when switching folders.
    useEffect(() => {
        setUncatalogedOnly(false);
    }, [currentFolder?.id]);

    const currentPhoto = viewablePhotos[currentPhotoIndex] ?? null;
    const relatedPhotos = useMemo(() => (currentPhoto ? findRelatedPhotos(currentPhoto, allPhotos) : []), [currentPhoto, allPhotos]);
    const enlargedRelated = relatedPhotos.find((r) => r.photo.id === enlargedRelatedId) ?? null;

    // Reset the enlargement whenever the current photo changes.
    useEffect(() => {
        setEnlargedRelatedId(null);
    }, [currentPhoto?.id]);

    // Allow Escape to cancel related-photo enlargement or return to the gallery.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key !== 'Escape') return;
            if (enlargedRelated) setEnlargedRelatedId(null);
            else if (view === 'photo') backToGallery();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [enlargedRelated, view, backToGallery]);

    const handleNext = useCallback(() => nextPhoto(viewablePhotos.length), [nextPhoto, viewablePhotos.length]);
    const handlePrev = useCallback(() => prevPhoto(viewablePhotos.length), [prevPhoto, viewablePhotos.length]);

    function handleLogout() {
        logout.mutate(undefined, {
            onSuccess: () => navigate('/login', { replace: true }),
        });
    }

    const displayPhoto = enlargedRelated ? enlargedRelated.photo : currentPhoto;
    // Anonymous view link for the displayed photo — fetched lazily and cached forever.
    const { data: shareLink } = useGetShareLink(currentFolder?.id ?? null, displayPhoto?.id ?? null);
    const isAlbums = view === 'albums';
    const isGallery = view === 'gallery';
    const isPhoto = view === 'photo';
    const isAdmin = me?.role === 'admin';
    const isCurrentCover = !!currentPhoto && !!currentFolder && currentFolder.coverFileName === currentPhoto.name;

    const handleToggleCover = () => {
        if (!currentFolder || !currentPhoto) return;
        if (isCurrentCover) {
            clearCover.mutate({ folderId: currentFolder.id });
        } else {
            setCover.mutate({ folderId: currentFolder.id, fileName: currentPhoto.name });
        }
    };

    return (
        <>
            {/* Preload next 2 photos when viewing a single photo */}
            {isPhoto &&
                viewablePhotos
                    .slice(currentPhotoIndex + 1, currentPhotoIndex + 3)
                    .map((p) => <link key={p.id} rel="preload" as="image" href={p.downloadUrl} />)}

            <ViewerLayout
                header={
                    <div className="flex items-center justify-between">
                        {isAlbums ? (
                            <div className="px-4 py-2 text-sm font-medium">All albums</div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={goToAlbums}
                                    title="Click here to browse albums"
                                    aria-label="Browse albums"
                                >
                                    <LibraryBig className="h-4 w-4" />
                                </Button>
                                <FolderSelector
                                    folders={folders}
                                    selectedIndex={currentFolderIndex}
                                    onSelect={setFolder}
                                    isLoading={foldersLoading}
                                />
                            </div>
                        )}
                        <div className="flex items-center gap-3 px-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/favorites')}
                                title="My favorites"
                                aria-label="My favorites"
                            >
                                <Heart className="mr-2 h-4 w-4" />
                                Favorites
                            </Button>
                            {isPhoto && (
                                <Button variant="ghost" size="sm" onClick={backToGallery}>
                                    <LayoutGrid className="mr-2 h-4 w-4" />
                                    Gallery
                                </Button>
                            )}
                            {isAdmin && isPhoto && currentPhoto && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleToggleCover}
                                    disabled={setCover.isPending || clearCover.isPending}
                                >
                                    {isCurrentCover ? (
                                        <>
                                            <StarOff className="mr-2 h-4 w-4" />
                                            Clear album cover
                                        </>
                                    ) : (
                                        <>
                                            <Star className="mr-2 h-4 w-4" />
                                            Set as album cover
                                        </>
                                    )}
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
                    isAlbums ? (
                        <AlbumGallery folders={folders} onSelect={setFolder} />
                    ) : isGallery ? (
                        <PhotoGallery photos={viewablePhotos} isLoading={photosLoading && !!currentFolder} onSelect={openPhoto} />
                    ) : (
                        <LetterboxViewer
                            photo={displayPhoto}
                            isLoading={photosLoading && !!currentFolder}
                            onClick={enlargedRelated ? () => setEnlargedRelatedId(null) : undefined}
                        />
                    )
                }
                rightPanel={
                    isPhoto && relatedPhotos.length > 0 && !enlargedRelated ? (
                        <div className="flex flex-col gap-3 p-4">
                            {relatedPhotos.map((r) => (
                                <RelatedThumbnail
                                    key={r.photo.id}
                                    photo={r.photo}
                                    label={r.label}
                                    onClick={() => setEnlargedRelatedId(r.photo.id)}
                                />
                            ))}
                        </div>
                    ) : undefined
                }
                toolbar={
                    isAlbums ? (
                        <div className="flex items-center justify-center px-4 py-2 text-sm text-muted-foreground">
                            {folders.length} {folders.length === 1 ? 'album' : 'albums'}
                        </div>
                    ) : isGallery ? (
                        <div className="flex items-center justify-center gap-4 px-4 py-2 text-sm text-muted-foreground">
                            <span>
                                {viewablePhotos.length} {viewablePhotos.length === 1 ? 'photo' : 'photos'}
                                {uncatalogedOnly && ' (uncataloged only)'}
                            </span>
                            {isAdmin && uncatalogedCount > 0 && (
                                <Button
                                    variant={uncatalogedOnly ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setUncatalogedOnly((v) => !v)}
                                >
                                    <Filter className="mr-2 h-4 w-4" />
                                    {uncatalogedOnly ? 'Show all' : `${uncatalogedCount} uncataloged`}
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-6 px-4 py-2">
                            <PhotoControls
                                currentIndex={currentPhotoIndex}
                                totalCount={viewablePhotos.length}
                                onPrev={handlePrev}
                                onNext={handleNext}
                            />
                            {displayPhoto && (
                                <span className="max-w-[40ch] truncate text-sm text-muted-foreground" title={displayPhoto.name}>
                                    {displayPhoto.name}
                                </span>
                            )}
                            {shareLink && (
                                <Button variant="ghost" size="sm" asChild>
                                    <a href={shareLink} target="_blank" rel="noreferrer" title="Open in OneDrive">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Open in OneDrive
                                    </a>
                                </Button>
                            )}
                            {currentPhoto?.catalogId && currentFolder && (
                                <StarRating
                                    rating={currentPhoto.rating}
                                    disabled={ratePhoto.isPending}
                                    onChange={(rating) =>
                                        ratePhoto.mutate({
                                            catalogId: currentPhoto.catalogId!,
                                            folderId: currentFolder.id,
                                            rating,
                                        })
                                    }
                                />
                            )}
                        </div>
                    )
                }
            />
        </>
    );
}
