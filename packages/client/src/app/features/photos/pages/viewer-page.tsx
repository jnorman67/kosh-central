import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { CommentPanel } from '@/app/features/comments/components/comment-panel';
import { OcrPanel } from '@/app/features/ocr/components/ocr-panel';
import { OcrQueryProvider } from '@/app/features/ocr/contexts/ocr-query.context';
import { AlbumGallery } from '@/app/features/photos/components/album-gallery';
import { BackToGalleryButton } from '@/app/features/photos/components/back-to-gallery-button';
import { FolderSelector } from '@/app/features/photos/components/folder-selector';
import { LetterboxViewer } from '@/app/features/photos/components/letterbox-viewer';
import { MobilePanel } from '@/app/features/photos/components/mobile-panel';
import { PhotoControls } from '@/app/features/photos/components/photo-controls';
import { PhotoGallery } from '@/app/features/photos/components/photo-gallery';
import { PhotoPagesReader } from '@/app/features/photos/components/photo-pages-reader';
import { RelatedStrip } from '@/app/features/photos/components/related-strip';
import { RelatedThumbnail } from '@/app/features/photos/components/related-thumbnail';
import { SubfolderBreadcrumb } from '@/app/features/photos/components/subfolder-breadcrumb';
import { SubjectsPanel } from '@/app/features/photos/components/subjects-panel';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { SubjectsQueryProvider } from '@/app/features/photos/contexts/subjects-query.context';
import { photoKey, readPagesView, readSubfolderPath, useViewerState } from '@/app/features/photos/hooks/use-viewer-state';
import { coverName, isCoverPhoto } from '@/app/features/photos/lib/cover';
import { ALBUMS_PLACE, galleryPlace, rememberViewerLocation, subfolderFocus, updatePlace } from '@/app/features/photos/lib/places';
import type { Photo } from '@/app/features/photos/models/photos.models';
import { BrandMark } from '@/components/layout/brand-mark';
import { UserMenu } from '@/components/layout/user-menu';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { hideSplash } from '@/lib/splash';
import { ArrowRight, BookOpen, ChevronDown, ExternalLink, Filter, LayoutGrid, ScanFace, Star, StarOff, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

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

const FACE_MODE_STORAGE_KEY = 'kosh.viewer.faceMode';

export function ViewerPage() {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const { useGetFolders, useGetPhotos, useSetFolderCover, useClearFolderCover, useGetShareLink, useGetFaces } = usePhotosQueries();
    const setCover = useSetFolderCover();
    const clearCover = useClearFolderCover();
    const { useGetMe } = useAuthQueries();
    const { data: me } = useGetMe();
    const [enlargedRelatedId, setEnlargedRelatedId] = useState<string | null>(null);
    const [uncatalogedOnly, setUncatalogedOnly] = useState(false);
    const [disputeTarget, setDisputeTarget] = useState<{ personId: string; personName: string } | null>(null);
    const [faceMode, setFaceMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem(FACE_MODE_STORAGE_KEY) === '1';
    });
    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(FACE_MODE_STORAGE_KEY, faceMode ? '1' : '0');
    }, [faceMode]);

    const { data: folders = [], isLoading: foldersLoading } = useGetFolders();

    // Resolve the current folder from the URL so we can fetch its photos before
    // handing off to useViewerState (which needs viewablePhotos to resolve the photo param).
    const folderParam = searchParams.get('folder');
    const folderForFetch = useMemo(
        () => (folderParam ? (folders.find((f) => f.id === folderParam) ?? null) : null),
        [folders, folderParam],
    );
    // In a browse album, both views are scoped to the subfolder being viewed.
    const pathForFetch = readSubfolderPath(searchParams, folderForFetch);
    const pagesView = readPagesView(searchParams);
    // Always fetch gallery data — it tells us whether a pages subfolder exists.
    const { data: galleryData, isLoading: galleryLoading } = useGetPhotos(folderForFetch?.id ?? null, 'gallery', pathForFetch);
    // Fetch pages data only when the user has switched to that view; null folderId disables the query.
    const { data: pagesData, isLoading: pagesLoading } = useGetPhotos(
        pagesView ? (folderForFetch?.id ?? null) : null,
        'pages',
        pathForFetch,
    );
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
        currentPath,
        currentPhotoIndex,
        view: navView,
        setFolder,
        openSubfolder,
        setPagesView,
        openPhoto,
        backToGallery,
        goToAlbums,
        nextPhoto,
        prevPhoto,
    } = useViewerState({ folders, viewablePhotos });

    const uncatalogedCount = useMemo(() => allPhotos.filter((p) => !p.catalogId).length, [allPhotos]);

    // Reset the filter when switching folders or subfolders.
    useEffect(() => {
        setUncatalogedOnly(false);
    }, [currentFolder?.id, currentPath]);

    // Dismiss the initial splash once the first view's data is ready: folders always; also the
    // folder's photos if the URL selected one on first load.
    const initialDataReady = !foldersLoading && (!folderForFetch || !photosLoading);
    useEffect(() => {
        if (initialDataReady) hideSplash();
    }, [initialDataReady]);

    const currentPhoto = viewablePhotos[currentPhotoIndex] ?? null;
    const currentPhotoKey = navView === 'photo' && currentPhoto ? photoKey(currentPhoto) : null;

    // Remember where the user is, so "back to viewer" from other pages returns here and each
    // view highlights (and scrolls to) the album, subfolder or photo the user went into from it.
    useEffect(() => {
        rememberViewerLocation(location.search);
    }, [location.search]);
    useEffect(() => {
        if (!currentFolder) return;
        updatePlace(ALBUMS_PLACE, { focus: currentFolder.id });
        const segments = currentPath ? currentPath.split('/') : [];
        segments.forEach((_, i) => {
            const parent = segments.slice(0, i).join('/');
            updatePlace(galleryPlace(currentFolder.id, parent, false), { focus: subfolderFocus(segments.slice(0, i + 1).join('/')) });
        });
        if (currentPhotoKey) updatePlace(galleryPlace(currentFolder.id, currentPath, pagesView), { focus: currentPhotoKey });
    }, [currentFolder, currentPath, pagesView, currentPhotoKey]);

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
            else if (navView === 'gallery' && currentPath) openSubfolder(currentPath.split('/').slice(0, -1).join('/'));
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [enlargedRelated, navView, backToGallery, currentPath, openSubfolder]);

    const handleNext = useCallback(() => nextPhoto(), [nextPhoto]);
    const handlePrev = useCallback(() => prevPhoto(), [prevPhoto]);

    const displayPhoto = enlargedRelated ? enlargedRelated.photo : currentPhoto;
    // Anonymous view link for the displayed photo — fetched lazily and cached forever.
    // Photos of featured people live in other albums, so their link comes from there.
    const { data: shareLink } = useGetShareLink(displayPhoto?.sourceFolderId ?? currentFolder?.id ?? null, displayPhoto?.id ?? null);
    // Face boxes for the displayed photo. Only fetched when face mode is on AND the
    // photo is cataloged (uncataloged photos have no bundle and no sidecar rows).
    const { data: faces } = useGetFaces(displayPhoto?.catalogId, faceMode && !!displayPhoto?.catalogId);
    const isAlbums = navView === 'albums';
    const isGallery = navView === 'gallery';
    const isPhoto = navView === 'photo';
    const isAdmin = me?.role === 'admin';
    const subfolders = galleryData?.subfolders ?? [];
    const subfolderName = currentPath.split('/').pop() ?? '';
    // A cover belongs to a folder: the album itself or, in a browse album, the subfolder being viewed.
    const isAlbumCover = !!currentPhoto && isCoverPhoto(currentPhoto, currentFolder?.coverFileName);
    const isSubfolderCover = !!currentPhoto && !!currentPath && isCoverPhoto(currentPhoto, galleryData?.coverFileName, currentPath);
    // Where the featured album's own photos end and photos of its featured people begin.
    const featuredPeopleStart = viewablePhotos.findIndex((p) => !!p.sourceFolderId);
    const featuredPersonNames = photosData?.featuredPersonNames ?? [];

    const handleToggleCover = (path: string, isCover: boolean) => {
        if (!currentFolder || !currentPhoto) return;
        if (isCover) {
            clearCover.mutate({ folderId: currentFolder.id, path });
        } else {
            setCover.mutate({ folderId: currentFolder.id, fileName: coverName(currentPhoto, path), path });
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
                    <div className="flex min-h-[52px] items-center justify-between gap-2 pl-1 sm:pl-0">
                        {isAlbums ? (
                            <div className="flex min-w-0 items-center gap-2">
                                <BrandMark title="Kosh Central" />
                                <span className="hidden text-sm text-muted-foreground sm:inline">All albums</span>
                            </div>
                        ) : (
                            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                                {/* On phones the back button is the way out of a photo; the album list is a step further. */}
                                <div className={isPhoto ? 'hidden sm:block' : undefined}>
                                    <BrandMark onClick={goToAlbums} title="Browse albums" />
                                </div>
                                {isPhoto && (
                                    <BackToGalleryButton
                                        onClick={backToGallery}
                                        target={pagesView ? 'pages' : subfolderName || 'gallery'}
                                    />
                                )}
                                <FolderSelector
                                    folders={folders}
                                    selectedId={currentFolder?.id ?? null}
                                    onSelect={setFolder}
                                    isLoading={foldersLoading}
                                />
                                {isGallery && currentFolder && currentPath && (
                                    <SubfolderBreadcrumb
                                        path={currentPath}
                                        albumName={currentFolder.displayName}
                                        onNavigate={openSubfolder}
                                    />
                                )}
                            </div>
                        )}
                        <div className="flex shrink-0 items-center gap-1 pr-1 sm:gap-3 sm:px-4">
                            {isAdmin && isPhoto && currentPhoto && !currentPhoto.sourceFolderId && currentPath && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={setCover.isPending || clearCover.isPending}
                                            aria-label="Cover"
                                        >
                                            <Star className="h-4 w-4" />
                                            <span className="hidden md:inline">Cover</span>
                                            <ChevronDown className="hidden h-4 w-4 md:block" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => handleToggleCover(currentPath, isSubfolderCover)}>
                                            {isSubfolderCover ? <StarOff /> : <Star />}
                                            {isSubfolderCover ? 'Clear' : 'Set as'} cover of {subfolderName}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleToggleCover('', isAlbumCover)}>
                                            {isAlbumCover ? <StarOff /> : <Star />}
                                            {isAlbumCover ? 'Clear album cover' : 'Set as album cover'}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            {isAdmin && isPhoto && currentPhoto && !currentPhoto.sourceFolderId && !currentPath && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleCover('', isAlbumCover)}
                                    disabled={setCover.isPending || clearCover.isPending}
                                    aria-label={isAlbumCover ? 'Clear album cover' : 'Set as album cover'}
                                >
                                    {isAlbumCover ? (
                                        <>
                                            <StarOff className="h-4 w-4" />
                                            <span className="hidden md:inline">Clear album cover</span>
                                        </>
                                    ) : (
                                        <>
                                            <Star className="h-4 w-4" />
                                            <span className="hidden md:inline">Set as album cover</span>
                                        </>
                                    )}
                                </Button>
                            )}
                            <UserMenu />
                        </div>
                    </div>
                }
                viewer={
                    isAlbums ? (
                        <AlbumGallery folders={folders} onSelect={setFolder} placeKey={ALBUMS_PLACE} />
                    ) : isGallery ? (
                        pagesView ? (
                            <PhotoPagesReader
                                photos={viewablePhotos}
                                isLoading={photosLoading && !!currentFolder}
                                onSelect={openPhoto}
                                placeKey={galleryPlace(currentFolder?.id ?? '', currentPath, true)}
                            />
                        ) : (
                            <PhotoGallery
                                photos={viewablePhotos}
                                isLoading={photosLoading && !!currentFolder}
                                onSelect={openPhoto}
                                placeKey={galleryPlace(currentFolder?.id ?? '', currentPath, false)}
                                subfolders={subfolders}
                                onSelectSubfolder={openSubfolder}
                                section={
                                    featuredPeopleStart >= 0 && featuredPersonNames.length > 0
                                        ? {
                                              start: featuredPeopleStart,
                                              label: `More photos of ${new Intl.ListFormat('en', { type: 'conjunction' }).format(featuredPersonNames)}`,
                                          }
                                        : undefined
                                }
                            />
                        )
                    ) : (
                        <div className="relative h-full w-full">
                            <LetterboxViewer
                                photo={displayPhoto}
                                isLoading={photosLoading && !!currentFolder}
                                onClick={enlargedRelated ? () => setEnlargedRelatedId(null) : undefined}
                                onSwipeNext={handleNext}
                                onSwipePrev={handlePrev}
                                showFaces={faceMode}
                                faces={faces}
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
                mobilePanel={
                    isPhoto && !enlargedRelated && me && currentPhoto?.catalogId ? (
                        <MobilePanel
                            photoId={currentPhoto.catalogId}
                            bundleId={currentPhoto.bundleId}
                            currentUserId={me.id}
                            isAdmin={isAdmin}
                            initialBody={
                                disputeTarget
                                    ? `I don't think @[${disputeTarget.personName}](person:${disputeTarget.personId}) is in this photo.`
                                    : undefined
                            }
                            onCommentPosted={() => setDisputeTarget(null)}
                            onDisputeSubject={(personId, personName) => setDisputeTarget({ personId, personName })}
                        />
                    ) : undefined
                }
                rightPanel={
                    isPhoto && !enlargedRelated && me && currentPhoto?.catalogId ? (
                        <SubjectsQueryProvider>
                            <OcrQueryProvider>
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
                                    <SubjectsPanel
                                        photoId={currentPhoto.catalogId}
                                        isAdmin={isAdmin}
                                        onDisputeSubject={(personId, personName) => setDisputeTarget({ personId, personName })}
                                        className="shrink-0"
                                    />
                                    {currentPhoto.bundleId && (
                                        <OcrPanel
                                            bundleId={currentPhoto.bundleId}
                                            isAdmin={isAdmin}
                                            className="shrink-0 border-t border-amber-200"
                                        />
                                    )}
                                    <CommentPanel
                                        photoId={currentPhoto.catalogId}
                                        currentUserId={me.id}
                                        isAdmin={isAdmin}
                                        initialBody={
                                            disputeTarget
                                                ? `I don't think @[${disputeTarget.personName}](person:${disputeTarget.personId}) is in this photo.`
                                                : undefined
                                        }
                                        onCommentPosted={() => setDisputeTarget(null)}
                                        className="min-h-0 flex-1"
                                    />
                                </div>
                            </OcrQueryProvider>
                        </SubjectsQueryProvider>
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
                                {!pagesView &&
                                    subfolders.length > 0 &&
                                    `${subfolders.length} ${subfolders.length === 1 ? 'folder' : 'folders'} · `}
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
                                <Button variant={pagesView ? 'secondary' : 'ghost'} size="sm" onClick={() => setPagesView(!pagesView)}>
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
                                        {displayPhoto.sourceFolderDisplayName && ` · from ${displayPhoto.sourceFolderDisplayName}`}
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
                            <div className="flex items-center justify-end">
                                {displayPhoto?.catalogId && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={faceMode ? 'secondary' : 'ghost'}
                                                size="sm"
                                                onClick={() => setFaceMode((v) => !v)}
                                                aria-pressed={faceMode}
                                                aria-label="Toggle face boxes"
                                            >
                                                <ScanFace className="h-4 w-4" />
                                                <span className="hidden sm:inline">Faces</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{faceMode ? 'Hide face boxes' : 'Show face boxes'}</TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    )
                }
            />
        </>
    );
}
