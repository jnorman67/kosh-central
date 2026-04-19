import type { Photo, PhotoFolder } from '@/app/features/photos/models/photos.models';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type ViewMode = 'albums' | 'gallery' | 'photo';

const FOLDER_PARAM = 'folder';
const PHOTO_PARAM = 'photo';

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
            const next = new URLSearchParams();
            next.set(FOLDER_PARAM, folderId);
            updateParams(next);
        },
        [updateParams],
    );

    const openPhoto = useCallback(
        (index: number) => {
            const photo = viewablePhotos[index];
            if (!photo || !folderParam) return;
            const next = new URLSearchParams();
            next.set(FOLDER_PARAM, folderParam);
            next.set(PHOTO_PARAM, photoKey(photo));
            updateParams(next);
        },
        [viewablePhotos, folderParam, updateParams],
    );

    const backToGallery = useCallback(() => {
        if (!folderParam) return;
        const next = new URLSearchParams();
        next.set(FOLDER_PARAM, folderParam);
        updateParams(next, { replace: true });
    }, [folderParam, updateParams]);

    const goToAlbums = useCallback(() => {
        updateParams(new URLSearchParams());
    }, [updateParams]);

    const stepPhoto = useCallback(
        (delta: number) => {
            if (viewablePhotos.length === 0 || !folderParam) return;
            const nextIndex = (currentPhotoIndex + delta + viewablePhotos.length) % viewablePhotos.length;
            const photo = viewablePhotos[nextIndex];
            if (!photo) return;
            const next = new URLSearchParams();
            next.set(FOLDER_PARAM, folderParam);
            next.set(PHOTO_PARAM, photoKey(photo));
            updateParams(next, { replace: true });
        },
        [viewablePhotos, currentPhotoIndex, folderParam, updateParams],
    );

    const nextPhoto = useCallback(() => stepPhoto(1), [stepPhoto]);
    const prevPhoto = useCallback(() => stepPhoto(-1), [stepPhoto]);

    return {
        currentFolder,
        currentPhotoIndex,
        view,
        setFolder,
        openPhoto,
        backToGallery,
        goToAlbums,
        nextPhoto,
        prevPhoto,
    };
}
