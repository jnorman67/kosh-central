import type { MsalService } from '../auth/msal.service.js';

export interface Photo {
    id: string;
    name: string;
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

    constructor(private msalService: MsalService) {}

    encodeSharingUrl(url: string): string {
        const base64 = Buffer.from(url).toString('base64');
        const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return `u!${base64url}`;
    }

    async getPhotos(sharingUrl: string): Promise<Photo[]> {
        const cached = this.cache.get(sharingUrl);
        if (cached && Date.now() < cached.expiresAt) {
            return cached.data;
        }

        const accessToken = await this.msalService.getAccessToken();
        const encoded = this.encodeSharingUrl(sharingUrl);
        const graphUrl = `https://graph.microsoft.com/v1.0/shares/${encoded}/driveItem/children?$expand=thumbnails`;

        const response = await fetch(graphUrl, {
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
        const json = (await response.json()) as {
            value?: Array<{
                id: string;
                name: string;
                '@microsoft.graph.downloadUrl'?: string;
                file?: { mimeType: string };
                thumbnails?: ThumbnailSet[];
                parentReference?: { driveId?: string };
            }>;
        };

        const photos: Photo[] = (json.value ?? [])
            .filter((item) => item.file?.mimeType?.startsWith('image/'))
            .filter((item) => !!item.parentReference?.driveId)
            .map((item) => {
                const thumb = item.thumbnails?.[0];
                return {
                    id: item.id,
                    name: item.name,
                    downloadUrl: item['@microsoft.graph.downloadUrl'] ?? '',
                    thumbnailUrl: thumb?.large?.url ?? thumb?.medium?.url ?? thumb?.small?.url,
                    mimeType: item.file!.mimeType,
                    driveId: item.parentReference!.driveId!,
                };
            });

        this.cache.set(sharingUrl, { data: photos, expiresAt: Date.now() + this.TTL_MS });
        return photos;
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
