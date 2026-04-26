import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { CommentPanel } from '@/app/features/comments/components/comment-panel';
import { AlbumGallery } from '@/app/features/photos/components/album-gallery';
import { FolderSelector } from '@/app/features/photos/components/folder-selector';
import { LetterboxViewer } from '@/app/features/photos/components/letterbox-viewer';
import { PhotoControls } from '@/app/features/photos/components/photo-controls';
import { PhotoGallery } from '@/app/features/photos/components/photo-gallery';
import { PhotoPagesReader } from '@/app/features/photos/components/photo-pages-reader';
import { RelatedStrip } from '@/app/features/photos/components/related-strip';
import { RelatedThumbnail } from '@/app/features/photos/components/related-thumbnail';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { useViewerState } from '@/app/features/photos/hooks/use-viewer-state';
import type { Photo } from '@/app/features/photos/models/photos.models';
import { BrandMark } from '@/components/layout/brand-mark';
import { UserMenu } from '@/components/layout/user-menu';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { hideSplash } from '@/lib/splash';
import { ArrowRight, BookOpen, Check, ExternalLink, Filter, LayoutGrid, List, Star, StarOff, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface RelatedPhoto {
    photo: Photo;
    label: string;
}

/**
 * Collect the photos to show stacked on the side panel for the given main photo:
 * backs first, then other front versions. Siblings are discovered via shared
 * bundleId. Within each side, preferred peers sort first.
 */
function findRelatedPhotos(main: Photo, allPhotos: Photo[]): RelatedPhoto[] {
    if (!main.bundleId) return [];
    const siblings = allPhotos.filter((p) => p.bundleId === main.bundleId && p.id !== main.id);
    const backs: RelatedPhoto[] = [];
    const others: RelatedPhoto[] = [];
    for (const p of siblings) {
        if (p.side === 'back') backs.push({ photo: p, label: 'Back' });
        else if (p.side === 'front') others.push({ photo: p, label: 'Original' });
    }
    const byPreferredThenName = (a: RelatedPhoto, b: RelatedPhoto) => {
        if (!!a.photo.isPreferred !== !!b.photo.isPreferred) return a.photo.isPreferred ? -1 : 1;
        return a.photo.name.localeCompare(b.photo.name);
    };
    return [...backs.sort(byPreferredThenName), ...others.sort(byPreferredThenName)];
}

export function ViewerPage() {
    const [searchParams] = useSearchParams();
    const { useGetFolders, useGetPhotos, useSetFolderCover, useClearFolderCover, useSetPreferredPhoto, useGetShareLink } =
        usePhotosQueries();
    const setCover = useSetFolderCover();
    const clearCover = useClearFolderCover();
    const setPreferred = useSetPreferredPhoto();
    const { useGetMe } = useAuthQueries();
    const { data: me } = useGetMe();
    const [enlargedRelatedId, setEnlargedRelatedId] = useState<string | null>(null);
    const [uncatalogedOnly, setUncatalogedOnly] = useState(false);
    const [pagesView, setPagesView] = useState(false);

    const { data: folders = [], isLoading: foldersLoading } = useGetFolders();

    // Resolve the current folder from the URL so we can fetch its photos before
    // handing off to useViewerState (which needs viewablePhotos to resolve the photo param).
    const folderParam = searchParams.get('folder');
    const folderForFetch = useMemo(
        () => (folderParam ? (folders.find((f) => f.id === folderParam) ?? null) : null),
        [folders, folderParam],
    );
    // Always fetch gallery data — it tells us whether a pages subfolder exists.
    const { data: galleryData, isLoading: galleryLoading } = useGetPhotos(folderForFetch?.id ?? null, 'gallery');
    // Fetch pages data only when the user has switched to that view; null folderId disables the query.
    const { data: pagesData, isLoading: pagesLoading } = useGetPhotos(pagesView ? (folderForFetch?.id ?? null) : null, 'pages');
    const hasPagesSubfolder = galleryData?.hasPagesSubfolder ?? false;
    const photosData = pagesView ? pagesData : galleryData;
    const allPhotos = photosData?.photos ?? [];
    const photosLoading = pagesView ? pagesLoading : galleryLoading;

    // Show one photo per bundle in the gallery: the preferred front. Uncataloged
    // photos have no bundle info and are always shown. Photos that are siblings
    // (non-preferred, or backs) only appear as thumbnails in the side panel.
    // Pages view skips this filter — every page should be visible.
    const viewablePhotos = useMemo(() => {
        if (uncatalogedOnly) return allPhotos.filter((p) => !p.catalogId);
        if (pagesView) return allPhotos;
        return allPhotos.filter((p) => {
            if (!p.catalogId) return true;
            if (!p.bundleId) return true;
            return p.side === 'front' && !!p.isPreferred;
        });
    }, [allPhotos, uncatalogedOnly, pagesView]);

    const {
        currentFolder,
        currentPhotoIndex,
        view: navView,
        setFolder,
        openPhoto,
        backToGallery,
        goToAlbums,
        nextPhoto,
        prevPhoto,
    } = useViewerState({ folders, viewablePhotos });

    const uncatalogedCount = useMemo(() => allPhotos.filter((p) => !p.catalogId).length, [allPhotos]);

    // Reset filters when switching folders.
    useEffect(() => {
        setUncatalogedOnly(false);
        setPagesView(false);
    }, [currentFolder?.id]);

    // Dismiss the initial splash once the first view's data is ready: folders always; also the
    // folder's photos if the URL selected one on first load.
    const initialDataReady = !foldersLoading && (!folderForFetch || !photosLoading);
    useEffect(() => {
        if (initialDataReady) hideSplash();
    }, [initialDataReady]);

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
            const t = e.target as HTMLElement;
            if (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
            if (enlargedRelated) setEnlargedRelatedId(null);
            else if (navView === 'photo') backToGallery();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [enlargedRelated, navView, backToGallery]);

    const handleNext = useCallback(() => nextPhoto(), [nextPhoto]);
    const handlePrev = useCallback(() => prevPhoto(), [prevPhoto]);

    const displayPhoto = enlargedRelated ? enlargedRelated.photo : currentPhoto;
    // Anonymous view link for the displayed photo — fetched lazily and cached forever.
    const { data: shareLink } = useGetShareLink(currentFolder?.id ?? null, displayPhoto?.id ?? null);
    const isAlbums = navView === 'albums';
    const isGallery = navView === 'gallery';
    const isPhoto = navView === 'photo';
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

    const displayPhotoIsPreferred = !!displayPhoto?.isPreferred;
    const canSetPreferred = !!displayPhoto?.catalogId && !!displayPhoto.bundleId && !displayPhotoIsPreferred;
    const handleSetPreferred = () => {
        if (!displayPhoto?.catalogId || !currentFolder) return;
        setPreferred.mutate({ catalogId: displayPhoto.catalogId, folderId: currentFolder.id });
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
                    <div className="flex items-center justify-between gap-2">
                        {isAlbums ? (
                            <div className="flex min-w-0 items-center gap-2">
                                <BrandMark title="Kosh Central" />
                                <span className="hidden text-sm text-muted-foreground sm:inline">All albums</span>
                            </div>
                        ) : (
                            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                                <BrandMark onClick={goToAlbums} title="Browse albums" />
                                <FolderSelector
                                    folders={folders}
                                    selectedId={currentFolder?.id ?? null}
                                    onSelect={setFolder}
                                    isLoading={foldersLoading}
                                />
                            </div>
                        )}
                        <div className="flex shrink-0 items-center gap-1 pr-1 sm:gap-3 sm:px-4">
                            {isPhoto && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={backToGallery}
                                    aria-label={pagesView ? 'Back to pages' : 'Back to gallery'}
                                >
                                    {pagesView ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                                    <span className="hidden sm:inline">{pagesView ? 'Scroll' : 'Gallery'}</span>
                                </Button>
                            )}
                            {isAdmin && isPhoto && currentPhoto && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleToggleCover}
                                    disabled={setCover.isPending || clearCover.isPending}
                                    className="hidden md:inline-flex"
                                >
                                    {isCurrentCover ? (
                                        <>
                                            <StarOff className="h-4 w-4" />
                                            Clear album cover
                                        </>
                                    ) : (
                                        <>
                                            <Star className="h-4 w-4" />
                                            Set as album cover
                                        </>
                                    )}
                                </Button>
                            )}
                            {isAdmin && isPhoto && canSetPreferred && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleSetPreferred}
                                            disabled={setPreferred.isPending}
                                            className="hidden md:inline-flex"
                                        >
                                            <Check className="h-4 w-4" />
                                            Set as preferred
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Make this the preferred version for its side of the bundle</TooltipContent>
                                </Tooltip>
                            )}
                            <UserMenu />
                        </div>
                    </div>
                }
                viewer={
                    isAlbums ? (
                        <AlbumGallery folders={folders} onSelect={setFolder} />
                    ) : isGallery ? (
                        pagesView ? (
                            <PhotoPagesReader photos={viewablePhotos} isLoading={photosLoading && !!currentFolder} onSelect={openPhoto} />
                        ) : (
                            <PhotoGallery photos={viewablePhotos} isLoading={photosLoading && !!currentFolder} onSelect={openPhoto} />
                        )
                    ) : (
                        <div className="relative h-full w-full">
                            <LetterboxViewer
                                photo={displayPhoto}
                                isLoading={photosLoading && !!currentFolder}
                                onClick={enlargedRelated ? () => setEnlargedRelatedId(null) : undefined}
                                onSwipeNext={handleNext}
                                onSwipePrev={handlePrev}
                            />
                            {currentPhoto && relatedPhotos.length > 0 && (
                                <RelatedStrip
                                    className="md:hidden"
                                    mainPhoto={currentPhoto}
                                    related={relatedPhotos}
                                    selectedId={displayPhoto?.id ?? null}
                                    onSelectRelated={setEnlargedRelatedId}
                                    onBackToMain={() => setEnlargedRelatedId(null)}
                                />
                            )}
                            {enlargedRelated && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setEnlargedRelatedId(null)}
                                            className="absolute right-4 top-4 z-10 shadow"
                                        >
                                            <X className="h-4 w-4" />
                                            <span className="hidden sm:inline">Back to main photo</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Back to main photo (Esc)</TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    )
                }
                rightPanel={
                    isPhoto && !enlargedRelated && me && currentPhoto?.catalogId ? (
                        <div className="flex h-full flex-col">
                            {relatedPhotos.length > 0 && (
                                <div className="flex shrink-0 flex-col gap-3 border-b border-amber-200 p-4">
                                    {relatedPhotos.map((r) => (
                                        <RelatedThumbnail
                                            key={r.photo.id}
                                            photo={r.photo}
                                            label={r.label}
                                            onClick={() => setEnlargedRelatedId(r.photo.id)}
                                        />
                                    ))}
                                </div>
                            )}
                            <CommentPanel photoId={currentPhoto.catalogId} currentUserId={me.id} isAdmin={isAdmin} className="min-h-0 flex-1" />
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
                                {viewablePhotos.length}{' '}
                                {pagesView
                                    ? viewablePhotos.length === 1
                                        ? 'page'
                                        : 'pages'
                                    : viewablePhotos.length === 1
                                      ? 'photo'
                                      : 'photos'}
                                {uncatalogedOnly && ' (uncataloged only)'}
                            </span>
                            {hasPagesSubfolder && (
                                <Button variant={pagesView ? 'secondary' : 'ghost'} size="sm" onClick={() => setPagesView((v) => !v)}>
                                    {pagesView ? <LayoutGrid className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                                    {pagesView ? 'Gallery' : 'Pages'}
                                </Button>
                            )}
                            {pagesView && viewablePhotos.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => openPhoto(0)}>
                                    <ArrowRight className="h-4 w-4" />
                                    Sequential
                                </Button>
                            )}
                            {isAdmin && !pagesView && uncatalogedCount > 0 && (
                                <Button
                                    variant={uncatalogedOnly ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setUncatalogedOnly((v) => !v)}
                                >
                                    <Filter className="h-4 w-4" />
                                    {uncatalogedOnly ? 'Show all' : `${uncatalogedCount} uncataloged`}
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-2 px-2 py-2 sm:grid sm:grid-cols-3 sm:px-4">
                            <div className="hidden min-w-0 items-center justify-start gap-3 sm:flex">
                                {shareLink && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="sm" asChild className="shrink-0">
                                                <a href={shareLink} target="_blank" rel="noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                    <span className="sr-only">Open in OneDrive</span>
                                                </a>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Open in OneDrive</TooltipContent>
                                    </Tooltip>
                                )}
                                {displayPhoto && (
                                    <span className="truncate text-sm text-muted-foreground" title={displayPhoto.name}>
                                        {displayPhoto.name}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-center">
                                <PhotoControls
                                    currentIndex={currentPhotoIndex}
                                    totalCount={viewablePhotos.length}
                                    onPrev={handlePrev}
                                    onNext={handleNext}
                                />
                            </div>
                            <div className="flex items-center justify-end" />
                        </div>
                    )
                }
            />
        </>
    );
}
