import type { MsalService } from '../auth/msal.service.js';
import { fetchWithRetry } from './graph-fetch.js';

/** Thrown when a OneDrive sharing URL fails to resolve to a valid shared folder. */
export class ShareValidationError extends Error {
    constructor(
        message: string,
        public detail?: string,
    ) {
        super(message);
        this.name = 'ShareValidationError';
    }
}

export interface Photo {
    id: string;
    name: string;
    /**
     * Path from the album root to the file's containing folder, forward-slashed.
     * Empty string when the photo sits directly in the album root.
     */
    subfolderPath: string;
    downloadUrl: string;
    thumbnailUrl?: string;
    mimeType: string;
    /** Drive the item lives on — needed to mint an anonymous share link via createLink. */
    driveId: string;
}

/**
 * Path of the folder whose "pages" subfolder a photo sits in, relative to the album root, or null
 * when the photo isn't in a pages folder. Pages folders can sit at any depth:
 * "pages" → "", "1940s/pages" → "1940s", "1940s/pages/extra" → "1940s".
 */
export function pagesOwnerPath(subfolderPath: string): string | null {
    if (!subfolderPath) return null;
    const segments = subfolderPath.split('/');
    const i = segments.findIndex((s) => s.toLowerCase() === 'pages');
    return i === -1 ? null : segments.slice(0, i).join('/');
}

/** Returns true when a photo's subfolderPath is (or descends into) a subfolder named "pages", at any depth. */
export function isInPagesSubfolder(subfolderPath: string): boolean {
    return pagesOwnerPath(subfolderPath) !== null;
}

interface CacheEntry {
    data: Photo[];
    fetchedAt: number;
}

export class OneDriveService {
    private cache = new Map<string, CacheEntry>();
    /** Listings being fetched right now, so concurrent requests for an album share one walk. */
    private inFlight = new Map<string, Promise<Photo[]>>();
    /** itemId → anonymous view URL. Graph's createLink is idempotent per-app, so these are stable. */
    private shareLinkCache = new Map<string, string>();

    /** A listing older than this is still served, but refreshed in the background. */
    private static readonly REFRESH_AFTER_MS = 10 * 60 * 1000;
    /** Graph's download and thumbnail URLs expire after about an hour, so never serve a listing older than this. */
    private static readonly MAX_AGE_MS = 45 * 60 * 1000;
    /** How often startWarming re-lists every album. */
    private static readonly WARM_INTERVAL_MS = 5 * 60 * 1000;

    private static readonly FETCH_TIMEOUT_MS = 30_000;

    constructor(private msalService: MsalService) {}

    encodeSharingUrl(url: string): string {
        const base64 = Buffer.from(url).toString('base64');
        const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return `u!${base64url}`;
    }

    /**
     * Lightweight probe to confirm a sharing URL resolves to a shared folder.
     * Used by the admin UI before persisting a new/edited folder config so bad
     * URLs are caught at save time rather than when users try to browse.
     */
    async validateSharingUrl(sharingUrl: string): Promise<void> {
        const accessToken = await this.msalService.getAccessToken();
        const encoded = this.encodeSharingUrl(sharingUrl);
        const url = `https://graph.microsoft.com/v1.0/shares/${encoded}/driveItem?$select=id,folder`;
        const res = await fetch(url, {
            signal: AbortSignal.timeout(OneDriveService.FETCH_TIMEOUT_MS),
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new ShareValidationError(`Share URL not reachable: ${res.status} ${res.statusText}`, body);
        }
        const json = (await res.json()) as { folder?: unknown };
        if (!json.folder) {
            throw new ShareValidationError('Share URL resolves to a non-folder item');
        }
    }

    /**
     * An album's photos, from the cache when possible. Listing an album walks every subfolder
     * through Graph at a few seconds per request, so a stale listing is served at once while a
     * fresh one is fetched in the background; only a missing or expired listing makes the caller wait.
     */
    async getPhotos(sharingUrl: string): Promise<Photo[]> {
        const cached = this.cache.get(sharingUrl);
        const age = cached ? Date.now() - cached.fetchedAt : Infinity;
        if (cached && age < OneDriveService.MAX_AGE_MS) {
            if (age >= OneDriveService.REFRESH_AFTER_MS) {
                this.refresh(sharingUrl).catch((err) => console.error('OneDrive background refresh failed:', err));
            }
            return cached.data;
        }
        return this.refresh(sharingUrl);
    }

    /**
     * Keep every album's listing fresh so visitors never wait on Graph. Lists each album right
     * away, then again every few minutes, one at a time to go easy on Graph and the server's CPU.
     * `listFolders` is called each round so albums added or removed by admins are picked up.
     */
    startWarming(listFolders: () => { slug: string; sharingUrl: string }[]): void {
        const warm = async () => {
            const start = Date.now();
            let refreshed = 0;
            try {
                for (const folder of listFolders()) {
                    const cached = this.cache.get(folder.sharingUrl);
                    if (cached && Date.now() - cached.fetchedAt < OneDriveService.WARM_INTERVAL_MS) continue;
                    try {
                        await this.refresh(folder.sharingUrl);
                        refreshed++;
                    } catch (err) {
                        console.error(`OneDrive warm failed for ${folder.slug}:`, err);
                    }
                }
                console.log(`OneDrive warm: ${refreshed} albums listed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
            } catch (err) {
                console.error('OneDrive warm failed:', err);
            } finally {
                setTimeout(() => void warm(), OneDriveService.WARM_INTERVAL_MS).unref();
            }
        };
        void warm();
    }

    /** Fetch a fresh listing into the cache, joining a fetch of the same album already under way. */
    private refresh(sharingUrl: string): Promise<Photo[]> {
        const pending = this.inFlight.get(sharingUrl);
        if (pending) return pending;
        const fetching = this.fetchPhotos(sharingUrl)
            .then((photos) => {
                this.cache.set(sharingUrl, { data: photos, fetchedAt: Date.now() });
                return photos;
            })
            .finally(() => this.inFlight.delete(sharingUrl));
        this.inFlight.set(sharingUrl, fetching);
        return fetching;
    }

    private async fetchPhotos(sharingUrl: string): Promise<Photo[]> {
        const accessToken = await this.msalService.getAccessToken();
        const encoded = this.encodeSharingUrl(sharingUrl);
        const rootChildrenUrl = `https://graph.microsoft.com/v1.0/shares/${encoded}/driveItem/children?$expand=thumbnails`;

        const photos: Photo[] = [];
        await this.collectPhotos(rootChildrenUrl, accessToken, '', photos);
        return photos;
    }

    /**
     * Walk a children listing, appending image items to `out` and recursing
     * into folder items. Follows `@odata.nextLink` for paginated listings.
     */
    private async collectPhotos(
        childrenUrl: string,
        accessToken: string,
        subfolderPath: string,
        out: Photo[],
    ): Promise<void> {
        const response = await fetchWithRetry(
            childrenUrl,
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            },
            OneDriveService.FETCH_TIMEOUT_MS,
        );
        if (!response.ok) {
            throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
        }

        type ThumbnailSet = {
            small?: { url: string };
            medium?: { url: string };
            large?: { url: string };
        };
        type Item = {
            id: string;
            name: string;
            '@microsoft.graph.downloadUrl'?: string;
            file?: { mimeType: string };
            folder?: { childCount?: number };
            thumbnails?: ThumbnailSet[];
            parentReference?: { driveId?: string };
        };
        const json = (await response.json()) as { value?: Item[]; '@odata.nextLink'?: string };

        for (const item of json.value ?? []) {
            if (item.folder) {
                if (['archive', 'archived', 'ignore'].includes(item.name.toLowerCase())) continue;
                const driveId = item.parentReference?.driveId;
                if (!driveId) continue;
                const childUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${item.id}/children?$expand=thumbnails`;
                const nextSub = subfolderPath ? `${subfolderPath}/${item.name}` : item.name;
                await this.collectPhotos(childUrl, accessToken, nextSub, out);
                continue;
            }
            if (!item.file?.mimeType?.startsWith('image/')) continue;
            if (!item.parentReference?.driveId) continue;
            const thumb = item.thumbnails?.[0];
            out.push({
                id: item.id,
                name: item.name,
                subfolderPath,
                downloadUrl: item['@microsoft.graph.downloadUrl'] ?? '',
                thumbnailUrl: thumb?.large?.url ?? thumb?.medium?.url ?? thumb?.small?.url,
                mimeType: item.file.mimeType,
                driveId: item.parentReference.driveId,
            });
        }

        if (json['@odata.nextLink']) {
            await this.collectPhotos(json['@odata.nextLink'], accessToken, subfolderPath, out);
        }
    }

    /**
     * Mint (or return cached) anonymous view link for a drive item.
     * Graph's createLink returns the existing link if one already exists for this app,
     * so calling repeatedly is safe — we cache in memory to avoid the extra Graph round-trip.
     */
    async getOrCreateShareLink(driveId: string, itemId: string): Promise<string> {
        const cached = this.shareLinkCache.get(itemId);
        if (cached) return cached;

        const accessToken = await this.msalService.getAccessToken();
        const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/createLink`;
        const res = await fetch(url, {
            method: 'POST',
            signal: AbortSignal.timeout(OneDriveService.FETCH_TIMEOUT_MS),
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ type: 'view', scope: 'anonymous' }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '<no body>');
            throw new Error(`Graph createLink error: ${res.status} ${res.statusText} — ${body}`);
        }
        const json = (await res.json()) as { link?: { webUrl?: string } };
        const webUrl = json.link?.webUrl;
        if (!webUrl) throw new Error('createLink response missing link.webUrl');
        this.shareLinkCache.set(itemId, webUrl);
        return webUrl;
    }
}
