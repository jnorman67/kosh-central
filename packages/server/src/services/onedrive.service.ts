import type { MsalService } from '../auth/msal.service.js';

export interface Photo {
    id: string;
    name: string;
    downloadUrl: string;
    thumbnailUrl?: string;
    mimeType: string;
}

interface CacheEntry {
    data: Photo[];
    expiresAt: number;
}

export class OneDriveService {
    private cache = new Map<string, CacheEntry>();
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

        const json = (await response.json()) as {
            value?: Array<{
                id: string;
                name: string;
                '@microsoft.graph.downloadUrl'?: string;
                file?: { mimeType: string };
            }>;
        };

        const photos: Photo[] = (json.value ?? [])
            .filter((item) => item.file?.mimeType?.startsWith('image/'))
            .map((item) => ({
                id: item.id,
                name: item.name,
                downloadUrl: item['@microsoft.graph.downloadUrl'] ?? '',
                mimeType: item.file!.mimeType,
            }));

        this.cache.set(sharingUrl, { data: photos, expiresAt: Date.now() + this.TTL_MS });
        return photos;
    }
}
