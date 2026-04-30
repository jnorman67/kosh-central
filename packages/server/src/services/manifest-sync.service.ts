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
    photosStaleRemoved: number;
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
            photosStaleRemoved: 0,
            errors: [],
        };

        for (const folder of folders) {
            try {
                const refs = await this.findManifestFiles(folder.sharingUrl);
                result.foldersChecked += refs.length;
                for (const ref of refs) {
                    await this.processManifestFile(ref, folder.folderPath, folderRoots, result);
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
        folderPath: string,
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

        // Derive the absolute folder path from where the manifest lives in OneDrive.
        // ref.folderName is the subfolder path within the sharing-URL root (empty for the root itself).
        const absoluteFolderPath = ref.folderName ? `${folderPath}/${ref.folderName}` : folderPath;

        // Normalise each entry so folderName and bundleKey are absolute regardless
        // of what root the scanner was run from. bundleKey may already carry the full
        // path prefix (old scanner format) or just the local base name (new format);
        // either way we extract the local part after the last "::" and reconstruct.
        const photos = raw.photos.map((p) => ({
            ...p,
            folderName: absoluteFolderPath,
            bundleKey: p.bundleKey
                ? `${absoluteFolderPath}::${p.bundleKey.includes('::') ? p.bundleKey.split('::').pop()! : p.bundleKey}`
                : p.bundleKey,
        }));

        const activeHashes = new Set(photos.map((p) => p.contentHash));
        result.photosStaleRemoved += this.removeStalePhotos(absoluteFolderPath, activeHashes);

        const importResult = importManifest(photos, folderRoots);
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
            `Manifest sync: ${ref.folderName || 'root'} — ${importResult.created} new, ${importResult.existing} existing, ${result.photosStaleRemoved} stale removed`,
        );
    }

    /**
     * For a single folder, delete location records for photos absent from the
     * new manifest, then clear bundle membership for any photo that has no
     * remaining locations. Photo rows themselves are kept as content-addressed
     * preservation records.
     */
    private removeStalePhotos(folderName: string, activeHashes: Set<string>): number {
        const db = getDb();
        interface Row { id: string; content_hash: string; bundle_id: string | null; side: string | null }

        const inFolder = db.prepare(`
            SELECT p.id, p.content_hash, p.bundle_id, p.side
            FROM photos p
            JOIN photo_locations l ON l.photo_id = p.id
            WHERE l.folder_name = ? COLLATE NOCASE
        `).all(folderName) as Row[];

        const stale = inFolder.filter((p) => !activeHashes.has(p.content_hash));
        if (stale.length === 0) return 0;

        const deleteLocation = db.prepare(
            'DELETE FROM photo_locations WHERE photo_id = ? AND folder_name = ? COLLATE NOCASE',
        );
        const countLocations = db.prepare('SELECT COUNT(*) as cnt FROM photo_locations WHERE photo_id = ?');
        const clearBundle = db.prepare(
            'UPDATE photos SET bundle_id = NULL, side = NULL, is_preferred = 0 WHERE id = ?',
        );

        db.transaction(() => {
            for (const photo of stale) {
                deleteLocation.run(photo.id, folderName);
                const { cnt } = countLocations.get(photo.id) as { cnt: number };
                if (cnt === 0 && (photo.bundle_id || photo.side)) {
                    clearBundle.run(photo.id);
                }
            }
        })();

        return stale.length;
    }
}
