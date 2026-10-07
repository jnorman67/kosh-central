import { getPlace, updatePlace } from '@/app/features/photos/lib/places';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

/**
 * Restores a scroll container to where the user left it, then makes sure the item they last
 * opened from it is on screen. `ready` should flip true once the container's content is rendered;
 * restoration happens once per place. Items are matched to the focus by their `data-place-item`.
 */
export function usePlaceMemory<T extends HTMLElement>(placeKey: string, ready: boolean) {
    const ref = useRef<T>(null);
    const restoredFor = useRef<string | null>(null);
    const focus = useMemo(() => getPlace(placeKey).focus ?? null, [placeKey]);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!ready || !el || restoredFor.current === placeKey) return;
        restoredFor.current = placeKey;
        el.scrollTop = getPlace(placeKey).scrollTop ?? 0;
        if (!focus) return;
        // The user may have stepped through many photos since opening this view, so the saved
        // offset alone can leave the photo they came back from off screen.
        const item = el.querySelector(`[data-place-item="${CSS.escape(focus)}"]`);
        if (!item) return;
        const box = el.getBoundingClientRect();
        const rect = item.getBoundingClientRect();
        if (rect.top < box.top || rect.bottom > box.bottom) item.scrollIntoView({ block: 'center' });
    }, [placeKey, ready, focus]);

    useEffect(() => {
        const el = ref.current;
        if (!ready || !el) return;
        const onScroll = () => updatePlace(placeKey, { scrollTop: el.scrollTop });
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [placeKey, ready]);

    return { ref, focus };
}
