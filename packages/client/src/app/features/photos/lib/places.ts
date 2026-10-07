/**
 * Remembers where the user was in the viewer so moving around the app doesn't lose their place:
 * the viewer URL to return to from other pages, and for each scrollable view (the album list, a
 * gallery, a pages reader) its scroll offset plus the item last opened from it. Kept in
 * sessionStorage so it survives a reload but stays scoped to the tab.
 */

const VIEWER_LOCATION_KEY = 'kosh.viewer.location';
const PLACES_KEY = 'kosh.viewer.places';

export interface Place {
    scrollTop?: number;
    /** The item last opened from this view: highlighted and kept in view on return. */
    focus?: string;
}

export const ALBUMS_PLACE = 'albums';

/** One place per album subfolder and view, since each scrolls independently. */
export function galleryPlace(folderId: string, path: string, pagesView: boolean): string {
    return `${pagesView ? 'pages' : 'gallery'}:${folderId}:${path}`;
}

/** Focus key for a subfolder tile, kept apart from photo keys (content hashes or file names). */
export function subfolderFocus(path: string): string {
    return `dir:${path}`;
}

function readPlaces(): Record<string, Place> {
    try {
        return JSON.parse(sessionStorage.getItem(PLACES_KEY) ?? '{}') as Record<string, Place>;
    } catch {
        return {};
    }
}

let places = readPlaces();
let persistTimer: number | undefined;

// Scroll events arrive in bursts; write once they settle.
function persistPlaces() {
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => sessionStorage.setItem(PLACES_KEY, JSON.stringify(places)), 250);
}

export function getPlace(key: string): Place {
    return places[key] ?? {};
}

export function updatePlace(key: string, patch: Place) {
    places = { ...places, [key]: { ...places[key], ...patch } };
    persistPlaces();
}

export function rememberViewerLocation(search: string) {
    sessionStorage.setItem(VIEWER_LOCATION_KEY, search);
}

/** The viewer URL the user last had open, for "back to viewer" links on other pages. */
export function viewerLocation(): string {
    return `/${sessionStorage.getItem(VIEWER_LOCATION_KEY) ?? ''}`;
}

/** Forget everything, e.g. on sign-out, so the next user of the tab starts fresh. */
export function forgetPlaces() {
    window.clearTimeout(persistTimer);
    places = {};
    sessionStorage.removeItem(PLACES_KEY);
    sessionStorage.removeItem(VIEWER_LOCATION_KEY);
}
