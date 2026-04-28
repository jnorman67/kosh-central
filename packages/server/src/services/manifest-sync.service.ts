import type { MsalService } from '../auth/msal.service.js';
import { getDb } from '../db/database.js';
import { listFolders } from '../db/folders.store.js';
import { importManifest, type PhotoManifestEntry } from '../db/photos.store.js';

export interface ManifestSyncResult {
    foldersChecked: number;
    foldersImported: number;
    foldersUpToDate: number;
    photosCreated: number;
    photosExisting: number;
    errors: string[];
}

interface ManifestFileRef {
    itemId: string;
    folderName: string; // subfolder path relative to the sharing root
    downloadUrl: string;
}

type GraphItem = {
    id: string;
    name: string;
    '@microsoft.graph.downloadUrl'?: string;
    file?: { mimeType: string };
    folder?: object;
    parentReference?: { driveId?: string };
};

type GraphResponse = {
    value?: GraphItem[];
    '@odata.nextLink'?: string;
};

const FETCH_TIMEOUT_MS = 30_000;
const SKIP_FOLDER_NAMES = new Set(['archive', 'archived', 'ignore', 'ignored']);

function encodeSharingUrl(url: string): string {
    const base64 = Buffer.from(url).toString('base64');
    return `u!${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

export class ManifestSyncService {
    constructor(private msalService: MsalService) {}

    async sync(): Promise<ManifestSyncResult> {
        const folders = listFolders();
        const folderRoots = folders.map((f) => f.folderPath);
        const result: ManifestSyncResult = {
            foldersChecked: 0,
            foldersImported: 0,
            foldersUpToDate: 0,
            photosCreated: 0,
            photosExisting: 0,
            errors: [],
        };

        for (const folder of folders) {
            try {
                const refs = await this.findManifestFiles(folder.sharingUrl);
                result.foldersChecked += refs.length;
                for (const ref of refs) {
                    await this.processManifestFile(ref, folderRoots, result);
                }
            } catch (err) {
                result.errors.push(`${folder.slug}: ${(err as Error).message}`);
            }
        }

        return result;
    }

    private async findManifestFiles(sharingUrl: string): Promise<ManifestFileRef[]> {
        const accessToken = await this.msalService.getAccessToken();
        const encoded = encodeSharingUrl(sharingUrl);
        const rootUrl = `https://graph.microsoft.com/v1.0/shares/${encoded}/driveItem/children`;
        const refs: ManifestFileRef[] = [];
        await this.collectManifestFiles(rootUrl, accessToken, '', refs);
        return refs;
    }

    private async collectManifestFiles(
        childrenUrl: string,
        accessToken: string,
        subfolderPath: string,
        out: ManifestFileRef[],
    ): Promise<void> {
        const response = await fetch(childrenUrl, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            throw new Error(`Graph API error listing ${subfolderPath || 'root'}: ${response.status} ${response.statusText}`);
        }

        const json = (await response.json()) as GraphResponse;

        for (const item of json.value ?? []) {
            if (item.folder) {
                if (SKIP_FOLDER_NAMES.has(item.name.toLowerCase())) continue;
                const driveId = item.parentReference?.driveId;
                if (!driveId) continue;
                const childUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${item.id}/children`;
                const nextPath = subfolderPath ? `${subfolderPath}/${item.name}` : item.name;
                await this.collectManifestFiles(childUrl, accessToken, nextPath, out);
                continue;
            }

            if (item.name !== 'kosh-manifest.json') continue;
            const downloadUrl = item['@microsoft.graph.downloadUrl'];
            if (!downloadUrl) continue;
            out.push({ itemId: item.id, folderName: subfolderPath, downloadUrl });
        }

        if (json['@odata.nextLink']) {
            await this.collectManifestFiles(json['@odata.nextLink'], accessToken, subfolderPath, out);
        }
    }

    private async processManifestFile(
        ref: ManifestFileRef,
        folderRoots: string[],
        result: ManifestSyncResult,
    ): Promise<void> {
        const db = getDb();

        const response = await fetch(ref.downloadUrl, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok) {
            throw new Error(`Failed to download manifest for ${ref.folderName || 'root'}: ${response.status}`);
        }

        const raw = (await response.json()) as { scannedAt?: string; photos?: PhotoManifestEntry[] };
        if (!raw.scannedAt || !raw.photos?.length) return;

        const existing = db
            .prepare('SELECT scanned_at FROM manifest_syncs WHERE item_id = ?')
            .get(ref.itemId) as { scanned_at: string } | undefined;

        if (existing && existing.scanned_at >= raw.scannedAt) {
            result.foldersUpToDate++;
            return;
        }

        const importResult = importManifest(raw.photos, folderRoots);
        result.photosCreated += importResult.created;
        result.photosExisting += importResult.existing;
        result.foldersImported++;

        db.prepare(`
            INSERT INTO manifest_syncs (item_id, folder_name, scanned_at, synced_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(item_id) DO UPDATE SET
                folder_name = excluded.folder_name,
                scanned_at  = excluded.scanned_at,
                synced_at   = excluded.synced_at
        `).run(ref.itemId, ref.folderName, raw.scannedAt);

        console.log(
            `Manifest sync: ${ref.folderName || 'root'} — ${importResult.created} new, ${importResult.existing} existing`,
        );
    }
}
