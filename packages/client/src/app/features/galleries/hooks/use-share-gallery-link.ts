import { peopleLinkUrl } from '@/app/features/galleries/lib/people-link';
import type { GalleryInput } from '@/app/features/galleries/models/galleries.models';
import { useCallback, useEffect, useState } from 'react';

const COPIED_MS = 2000;

/**
 * Shares a link that opens the gallery's people for whoever follows it. Phones get the share sheet,
 * so the link can go straight into a message; elsewhere it's copied, and `copied` is set briefly.
 */
export function useShareGalleryLink() {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const share = useCallback(async (gallery: GalleryInput) => {
        const url = peopleLinkUrl(gallery);
        if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
            try {
                await navigator.share({ title: gallery.name, url });
                return;
            } catch (err) {
                // Dismissing the sheet isn't a failure; anything else falls back to copying.
                if (err instanceof DOMException && err.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            window.prompt('Copy this link to share the gallery:', url);
        }
    }, []);

    return { share, copied };
}
