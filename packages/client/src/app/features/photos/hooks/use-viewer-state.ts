import type { Photo, PhotoFolder } from '@/app/features/photos/models/photos.models';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type ViewMode = 'albums' | 'gallery' | 'photo';

const FOLDER_PARAM = 'folder';
const PATH_PARAM = 'path';
const PHOTO_PARAM = 'photo';

/** The subfolder of a browse album the URL points at ('' for its root). Flatten albums have no subfolders to open. */
export function readSubfolderPath(params: URLSearchParams, folder: PhotoFolder | null): string {
    if (folder?.subfolderMode !== 'browse') return '';
    return (params.get(PATH_PARAM) ?? '').split('/').filter(Boolean).join('/');
}

function buildParams(folderId: string, path: string, photo?: Photo): URLSearchParams {
    const next = new URLSearchParams();
    next.set(FOLDER_PARAM, folderId);
    if (path) next.set(PATH_PARAM, path);
    if (photo) next.set(PHOTO_PARAM, photoKey(photo));
    return next;
}

/** Stable identifier for a photo within a folder — content hash if cataloged, else file name. */
function photoKey(photo: Photo): string {
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

    const folderParam = params.get(FOLDER_PARAM);
    const photoParam = params.get(PHOTO_PARAM);

    const currentFolder = useMemo(() => (folderParam ? (folders.find((f) => f.id === folderParam) ?? null) : null), [folders, folderParam]);
    const currentPath = readSubfolderPath(params, currentFolder);

    const currentPhotoIndex = useMemo(() => {
        if (!photoParam || viewablePhotos.length === 0) return 0;
        const idx = findPhotoIndex(viewablePhotos, photoParam);
        return idx === -1 ? 0 : idx;
    }, [viewablePhotos, photoParam]);

    const photoParamResolvesToPhoto = useMemo(() => {
        if (!photoParam) return false;
        return findPhotoIndex(viewablePhotos, photoParam) !== -1;
    }, [viewablePhotos, photoParam]);

    const view: ViewMode = !currentFolder ? 'albums' : photoParamResolvesToPhoto ? 'photo' : 'gallery';

    const updateParams = useCallback(
        (next: URLSearchParams, opts?: { replace?: boolean }) => {
            setParams(next, { replace: opts?.replace ?? false });
        },
        [setParams],
    );

    const setFolder = useCallback(
        (folderId: string) => {
            updateParams(buildParams(folderId, ''));
        },
        [updateParams],
    );

    /** Open a subfolder of the current browse album; '' returns to the album root. */
    const openSubfolder = useCallback(
        (path: string) => {
            if (!folderParam) return;
            updateParams(buildParams(folderParam, path));
        },
        [folderParam, updateParams],
    );

    const openPhoto = useCallback(
        (index: number) => {
            const photo = viewablePhotos[index];
            if (!photo || !folderParam) return;
            updateParams(buildParams(folderParam, currentPath, photo));
        },
        [viewablePhotos, folderParam, currentPath, updateParams],
    );

    const backToGallery = useCallback(() => {
        if (!folderParam) return;
        updateParams(buildParams(folderParam, currentPath), { replace: true });
    }, [folderParam, currentPath, updateParams]);

    const goToAlbums = useCallback(() => {
        updateParams(new URLSearchParams());
    }, [updateParams]);

    const stepPhoto = useCallback(
        (delta: number) => {
            if (viewablePhotos.length === 0 || !folderParam) return;
            const nextIndex = (currentPhotoIndex + delta + viewablePhotos.length) % viewablePhotos.length;
            const photo = viewablePhotos[nextIndex];
            if (!photo) return;
            updateParams(buildParams(folderParam, currentPath, photo), { replace: true });
        },
        [viewablePhotos, currentPhotoIndex, folderParam, currentPath, updateParams],
    );

    const nextPhoto = useCallback(() => stepPhoto(1), [stepPhoto]);
    const prevPhoto = useCallback(() => stepPhoto(-1), [stepPhoto]);

    return {
        currentFolder,
        currentPath,
        currentPhotoIndex,
        view,
        setFolder,
        openSubfolder,
        openPhoto,
        backToGallery,
        goToAlbums,
        nextPhoto,
        prevPhoto,
    };
}
