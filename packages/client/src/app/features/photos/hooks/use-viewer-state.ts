import { useEffect, useReducer } from 'react';

const FOLDER_INDEX_KEY = 'kosh.selectedFolderIndex';

interface ViewerState {
    currentFolderIndex: number;
    currentPhotoIndex: number;
}

type ViewerAction =
    | { type: 'SET_FOLDER'; index: number }
    | { type: 'SET_PHOTO'; index: number }
    | { type: 'NEXT_PHOTO'; photoCount: number }
    | { type: 'PREV_PHOTO'; photoCount: number };

function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
    switch (action.type) {
        case 'SET_FOLDER':
            return { currentFolderIndex: action.index, currentPhotoIndex: 0 };
        case 'SET_PHOTO':
            return { ...state, currentPhotoIndex: action.index };
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
        setFolder: (index: number) => dispatch({ type: 'SET_FOLDER', index }),
        setPhoto: (index: number) => dispatch({ type: 'SET_PHOTO', index }),
        nextPhoto: (photoCount: number) => dispatch({ type: 'NEXT_PHOTO', photoCount }),
        prevPhoto: (photoCount: number) => dispatch({ type: 'PREV_PHOTO', photoCount }),
    };
}
