import type { MsalService } from '../auth/msal.service.js';

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

interface CacheEntry {
    data: Photo[];
    expiresAt: number;
}

export class OneDriveService {
    private cache = new Map<string, CacheEntry>();
    /** itemId → anonymous view URL. Graph's createLink is idempotent per-app, so these are stable. */
    private shareLinkCache = new Map<string, string>();
    private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

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

    async getPhotos(sharingUrl: string): Promise<Photo[]> {
        const cached = this.cache.get(sharingUrl);
        if (cached && Date.now() < cached.expiresAt) {
            return cached.data;
        }

        const accessToken = await this.msalService.getAccessToken();
        const encoded = this.encodeSharingUrl(sharingUrl);
        const rootChildrenUrl = `https://graph.microsoft.com/v1.0/shares/${encoded}/driveItem/children?$expand=thumbnails`;

        const photos: Photo[] = [];
        await this.collectPhotos(rootChildrenUrl, accessToken, '', photos);

        this.cache.set(sharingUrl, { data: photos, expiresAt: Date.now() + this.TTL_MS });
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
        const response = await fetch(childrenUrl, {
            signal: AbortSignal.timeout(OneDriveService.FETCH_TIMEOUT_MS),
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });
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
