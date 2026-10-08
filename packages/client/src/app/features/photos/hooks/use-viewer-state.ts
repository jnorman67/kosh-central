import type { Photo, PhotoFolder } from '@/app/features/photos/models/photos.models';
import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

type ViewMode = 'albums' | 'gallery' | 'photo';

const FOLDER_PARAM = 'folder';
const GALLERY_PARAM = 'gallery';
const PATH_PARAM = 'path';
const PHOTO_PARAM = 'photo';
const VIEW_PARAM = 'view';

/** History state on a photo entry pushed from a gallery, so "back to gallery" can pop to that entry. */
interface PhotoEntryState {
    openedFromGallery?: boolean;
}

/** The subfolder of a browse album the URL points at ('' for its root). Flatten albums have no subfolders to open. */
export function readSubfolderPath(params: URLSearchParams, folder: PhotoFolder | null): string {
    if (folder?.subfolderMode !== 'browse') return '';
    return (params.get(PATH_PARAM) ?? '').split('/').filter(Boolean).join('/');
}

/** Whether the URL asks for the album's pages (scanned document) view rather than its gallery. */
export function readPagesView(params: URLSearchParams): boolean {
    return !readGalleryId(params) && params.get(VIEW_PARAM) === 'pages';
}

/** The people gallery the URL points at, if it isn't pointing at an album. */
export function readGalleryId(params: URLSearchParams): string | null {
    return params.get(FOLDER_PARAM) ? null : params.get(GALLERY_PARAM);
}

/** What the viewer has open: an album or one of the user's people galleries. */
type Scope = { folderId: string } | { galleryId: string };

/** People galleries have no subfolders or pages view, so `path` and `pagesView` apply to albums only. */
function buildParams(scope: Scope, path = '', pagesView = false, photo?: Photo): URLSearchParams {
    const next = new URLSearchParams();
    if ('galleryId' in scope) {
        next.set(GALLERY_PARAM, scope.galleryId);
    } else {
        next.set(FOLDER_PARAM, scope.folderId);
        if (path) next.set(PATH_PARAM, path);
        if (pagesView) next.set(VIEW_PARAM, 'pages');
    }
    if (photo) next.set(PHOTO_PARAM, photoKey(photo));
    return next;
}

/** Stable identifier for a photo within a folder — content hash if cataloged, else file name. */
export function photoKey(photo: Photo): string {
    return photo.contentHash ?? photo.name;
}

function findPhotoIndex(photos: Photo[], key: string): number {
    const byHash = photos.findIndex((p) => p.contentHash === key);
    if (byHash !== -1) return byHash;
    return photos.findIndex((p) => p.name === key);
}

interface UseViewerStateArgs {
    folders: PhotoFolder[];
    viewablePhotos: Photo[];
}

export function useViewerState({ folders, viewablePhotos }: UseViewerStateArgs) {
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const entryState = location.state as PhotoEntryState | null;

    const folderParam = params.get(FOLDER_PARAM);
    const galleryParam = readGalleryId(params);
    const photoParam = params.get(PHOTO_PARAM);
    const scope = useMemo<Scope | null>(
        () => (folderParam ? { folderId: folderParam } : galleryParam ? { galleryId: galleryParam } : null),
        [folderParam, galleryParam],
    );

    const currentFolder = useMemo(() => (folderParam ? (folders.find((f) => f.id === folderParam) ?? null) : null), [folders, folderParam]);
    const currentPath = readSubfolderPath(params, currentFolder);
    const pagesView = readPagesView(params);

    const currentPhotoIndex = useMemo(() => {
        if (!photoParam || viewablePhotos.length === 0) return 0;
        const idx = findPhotoIndex(viewablePhotos, photoParam);
        return idx === -1 ? 0 : idx;
    }, [viewablePhotos, photoParam]);

    const photoParamResolvesToPhoto = useMemo(() => {
        if (!photoParam) return false;
        return findPhotoIndex(viewablePhotos, photoParam) !== -1;
    }, [viewablePhotos, photoParam]);

    const view: ViewMode = !currentFolder && !galleryParam ? 'albums' : photoParamResolvesToPhoto ? 'photo' : 'gallery';

    const updateParams = useCallback(
        (next: URLSearchParams, opts?: { replace?: boolean; state?: PhotoEntryState | null }) => {
            setParams(next, { replace: opts?.replace ?? false, state: opts?.state });
        },
        [setParams],
    );

    const setFolder = useCallback(
        (folderId: string) => {
            updateParams(buildParams({ folderId }));
        },
        [updateParams],
    );

    const openGallery = useCallback(
        (galleryId: string) => {
            updateParams(buildParams({ galleryId }));
        },
        [updateParams],
    );

    /** Open a subfolder of the current browse album; '' returns to the album root. */
    const openSubfolder = useCallback(
        (path: string) => {
            if (!folderParam) return;
            updateParams(buildParams({ folderId: folderParam }, path));
        },
        [folderParam, updateParams],
    );

    /** Switch between the album's gallery and its pages view. */
    const setPagesView = useCallback(
        (pages: boolean) => {
            if (!folderParam) return;
            updateParams(buildParams({ folderId: folderParam }, currentPath, pages));
        },
        [folderParam, currentPath, updateParams],
    );

    const openPhoto = useCallback(
        (index: number) => {
            const photo = viewablePhotos[index];
            if (!photo || !scope) return;
            updateParams(buildParams(scope, currentPath, pagesView, photo), { state: { openedFromGallery: true } });
        },
        [viewablePhotos, scope, currentPath, pagesView, updateParams],
    );

    const backToGallery = useCallback(() => {
        if (!scope) return;
        // Pop back to the gallery entry the photo was opened from rather than stacking a duplicate,
        // so the browser's back button then leaves the gallery as expected.
        if (entryState?.openedFromGallery) navigate(-1);
        else updateParams(buildParams(scope, currentPath, pagesView), { replace: true });
    }, [scope, currentPath, pagesView, entryState, navigate, updateParams]);

    const goToAlbums = useCallback(() => {
        updateParams(new URLSearchParams());
    }, [updateParams]);

    const stepPhoto = useCallback(
        (delta: number) => {
            if (viewablePhotos.length === 0 || !scope) return;
            const nextIndex = (currentPhotoIndex + delta + viewablePhotos.length) % viewablePhotos.length;
            const photo = viewablePhotos[nextIndex];
            if (!photo) return;
            updateParams(buildParams(scope, currentPath, pagesView, photo), { replace: true, state: entryState });
        },
        [viewablePhotos, currentPhotoIndex, scope, currentPath, pagesView, entryState, updateParams],
    );

    const nextPhoto = useCallback(() => stepPhoto(1), [stepPhoto]);
    const prevPhoto = useCallback(() => stepPhoto(-1), [stepPhoto]);

    return {
        currentFolder,
        currentGalleryId: galleryParam,
        currentPath,
        currentPhotoIndex,
        pagesView,
        view,
        setFolder,
        openGallery,
        openSubfolder,
        setPagesView,
        openPhoto,
        backToGallery,
        goToAlbums,
        nextPhoto,
        prevPhoto,
    };
}
