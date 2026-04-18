import { useEffect, useReducer } from 'react';

const FOLDER_INDEX_KEY = 'kosh.selectedFolderIndex';

type ViewMode = 'albums' | 'gallery' | 'photo';

interface ViewerState {
    currentFolderIndex: number;
    currentPhotoIndex: number;
    view: ViewMode;
}

type ViewerAction =
    | { type: 'SET_FOLDER'; index: number }
    | { type: 'OPEN_PHOTO'; index: number }
    | { type: 'BACK_TO_GALLERY' }
    | { type: 'GO_TO_ALBUMS' }
    | { type: 'NEXT_PHOTO'; photoCount: number }
    | { type: 'PREV_PHOTO'; photoCount: number };

function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
    switch (action.type) {
        case 'SET_FOLDER':
            return { currentFolderIndex: action.index, currentPhotoIndex: 0, view: 'gallery' };
        case 'OPEN_PHOTO':
            return { ...state, currentPhotoIndex: action.index, view: 'photo' };
        case 'BACK_TO_GALLERY':
            return { ...state, view: 'gallery' };
        case 'GO_TO_ALBUMS':
            return { ...state, view: 'albums' };
        case 'NEXT_PHOTO':
            if (action.photoCount === 0) return state;
            return { ...state, currentPhotoIndex: (state.currentPhotoIndex + 1) % action.photoCount };
        case 'PREV_PHOTO':
            if (action.photoCount === 0) return state;
            return { ...state, currentPhotoIndex: (state.currentPhotoIndex - 1 + action.photoCount) % action.photoCount };
    }
}

function readSavedFolderIndex(): number {
    try {
        const raw = localStorage.getItem(FOLDER_INDEX_KEY);
        if (raw === null) return 0;
        const n = Number.parseInt(raw, 10);
        return Number.isInteger(n) && n >= 0 ? n : 0;
    } catch {
        return 0;
    }
}

export function useViewerState() {
    const [state, dispatch] = useReducer(viewerReducer, undefined, () => ({
        currentFolderIndex: readSavedFolderIndex(),
        currentPhotoIndex: 0,
        view: 'gallery' as ViewMode,
    }));

    // Persist folder selection across reloads.
    useEffect(() => {
        try {
            localStorage.setItem(FOLDER_INDEX_KEY, String(state.currentFolderIndex));
        } catch {
            // storage disabled / full — non-fatal
        }
    }, [state.currentFolderIndex]);

    return {
        currentFolderIndex: state.currentFolderIndex,
        currentPhotoIndex: state.currentPhotoIndex,
        view: state.view,
        setFolder: (index: number) => dispatch({ type: 'SET_FOLDER', index }),
        openPhoto: (index: number) => dispatch({ type: 'OPEN_PHOTO', index }),
        backToGallery: () => dispatch({ type: 'BACK_TO_GALLERY' }),
        goToAlbums: () => dispatch({ type: 'GO_TO_ALBUMS' }),
        nextPhoto: (photoCount: number) => dispatch({ type: 'NEXT_PHOTO', photoCount }),
        prevPhoto: (photoCount: number) => dispatch({ type: 'PREV_PHOTO', photoCount }),
    };
}
