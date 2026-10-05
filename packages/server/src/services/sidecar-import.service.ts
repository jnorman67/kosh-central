import type { MsalService } from '../auth/msal.service.js';
import { getDb } from '../db/database.js';
import { findFolderBySlug, listFolders } from '../db/folders.store.js';
import { replaceCoworkFacesForBundle, type FaceBox, type SidedFaceBox } from '../db/persons.store.js';

export interface SidecarImportResult {
    sidecarsSeen: number;
    bundlesMatched: number;
    bundlesSkipped: number;
    facesInserted: number;
    errors: string[];
}

interface SidecarFileRef {
    itemId: string;
    fileName: string;
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

interface SidecarFile {
    fileName?: string;
    side?: unknown;
    faces?: unknown;
}

interface SidecarPayload {
    bundleKey?: string;
    files?: SidecarFile[];
}

const FETCH_TIMEOUT_MS = 30_000;
const SKIP_FOLDER_NAMES = new Set(['archive', 'archived', 'ignore', 'ignored', 'pages']);

function encodeSharingUrl(url: string): string {
    const base64 = Buffer.from(url).toString('base64');
    return `u!${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

export class SidecarImportService {
    constructor(private msalService: MsalService) {}

    async importAll(): Promise<SidecarImportResult> {
        return this.importFolders(listFolders());
    }

    async importOne(slug: string): Promise<SidecarImportResult> {
        const folder = findFolderBySlug(slug);
        if (!folder) throw new Error(`Folder not found: ${slug}`);
        return this.importFolders([folder]);
    }

    private async importFolders(folders: ReturnType<typeof listFolders>): Promise<SidecarImportResult> {
        const result: SidecarImportResult = {
            sidecarsSeen: 0,
            bundlesMatched: 0,
            bundlesSkipped: 0,
            facesInserted: 0,
            errors: [],
        };

        for (const folder of folders) {
            try {
                const refs = await this.findSidecarFiles(folder.sharingUrl);
                result.sidecarsSeen += refs.length;
                for (const ref of refs) {
                    await this.processSidecarFile(ref, folder.folderPath, result);
                }
            } catch (err) {
                result.errors.push(`${folder.slug}: ${(err as Error).message}`);
            }
        }

        return result;
    }

    private async findSidecarFiles(sharingUrl: string): Promise<SidecarFileRef[]> {
        const accessToken = await this.msalService.getAccessToken();
        const encoded = encodeSharingUrl(sharingUrl);
        const rootUrl = `https://graph.microsoft.com/v1.0/shares/${encoded}/driveItem/children`;
        const refs: SidecarFileRef[] = [];
        await this.collectSidecarFiles(rootUrl, accessToken, '', refs);
        return refs;
    }

    private async collectSidecarFiles(
        childrenUrl: string,
        accessToken: string,
        subfolderPath: string,
        out: SidecarFileRef[],
    ): Promise<void> {
        const response = await fetch(childrenUrl, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) {
            throw new Error(
                `Graph API error listing ${subfolderPath || 'root'}: ${response.status} ${response.statusText}`,
            );
        }

        const json = (await response.json()) as GraphResponse;

        for (const item of json.value ?? []) {
            if (item.folder) {
                if (SKIP_FOLDER_NAMES.has(item.name.toLowerCase())) continue;
                const driveId = item.parentReference?.driveId;
                if (!driveId) continue;
                const childUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${item.id}/children`;
                const nextPath = subfolderPath ? `${subfolderPath}/${item.name}` : item.name;
                await this.collectSidecarFiles(childUrl, accessToken, nextPath, out);
                continue;
            }

            // Sidecars are any *.json that isn't the folder manifest.
            if (!item.name.toLowerCase().endsWith('.json')) continue;
            if (item.name === 'kosh-manifest.json') continue;
            const downloadUrl = item['@microsoft.graph.downloadUrl'];
            if (!downloadUrl) continue;
            out.push({
                itemId: item.id,
                fileName: item.name,
                folderName: subfolderPath,
                downloadUrl,
            });
        }

        if (json['@odata.nextLink']) {
            await this.collectSidecarFiles(json['@odata.nextLink'], accessToken, subfolderPath, out);
        }
    }

    private async processSidecarFile(
        ref: SidecarFileRef,
        folderPath: string,
        result: SidecarImportResult,
    ): Promise<void> {
        const response = await fetch(ref.downloadUrl, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok) {
            result.errors.push(`Download ${ref.fileName}: ${response.status}`);
            return;
        }

        let parsed: SidecarPayload;
        try {
            parsed = (await response.json()) as SidecarPayload;
        } catch {
            // Not a JSON file we care about (e.g. some other tool's metadata).
            return;
        }

        if (!parsed.bundleKey || !Array.isArray(parsed.files)) return;

        const absoluteFolderPath = ref.folderName ? `${folderPath}/${ref.folderName}` : folderPath;
        const scannerKey = `${absoluteFolderPath}::${parsed.bundleKey}`;

        const bundleRow = getDb()
            .prepare('SELECT id FROM bundles WHERE scanner_key = ?')
            .get(scannerKey) as { id: string } | undefined;
        if (!bundleRow) {
            // Manifest hasn't been synced yet, or bundleKey doesn't match. Per schema doc: defer, don't error.
            result.bundlesSkipped++;
            return;
        }

        const boxes: SidedFaceBox[] = [];
        for (const file of parsed.files) {
            if (!Array.isArray(file.faces)) continue;
            if (file.side !== 'front' && file.side !== 'back') {
                // Schema requires side per file; skip rather than guess.
                result.errors.push(`${ref.fileName}: missing or invalid file.side (${String(file.side)})`);
                continue;
            }
            const side = file.side;
            for (const raw of file.faces) {
                if (!raw || typeof raw !== 'object') continue;
                const box = raw as Partial<FaceBox>;
                if (
                    typeof box.x === 'number' &&
                    typeof box.y === 'number' &&
                    typeof box.w === 'number' &&
                    typeof box.h === 'number'
                ) {
                    boxes.push({ x: box.x, y: box.y, w: box.w, h: box.h, side });
                }
            }
        }

        const inserted = replaceCoworkFacesForBundle(bundleRow.id, boxes);
        result.bundlesMatched++;
        result.facesInserted += inserted;
    }
}
