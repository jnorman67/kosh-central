#!/usr/bin/env npx tsx
/**
 * Local photo scanner.
 *
 * Walks configured folders (those with a `localPath`), computes SHA-256 for
 * each image file, and writes a JSON manifest to stdout (or a file).
 *
 * Usage:
 *   npx tsx packages/server/scripts/scan-local.ts                     # stdout
 *   npx tsx packages/server/scripts/scan-local.ts -o manifest.json    # file
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { FOLDERS } from '../src/config/folders.config.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.heic', '.heif']);

const MIME_MAP: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.bmp': 'image/bmp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
};

interface ManifestEntry {
    contentHash: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    folderName: string;
    folderUrl: string;
    localPath: string;
}

interface Manifest {
    scannedAt: string;
    photos: ManifestEntry[];
}

async function hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

async function scanFolder(folder: { displayName: string; sharingUrl: string; localPath: string }): Promise<ManifestEntry[]> {
    const entries: ManifestEntry[] = [];
    const dirEntries = await fsp.readdir(folder.localPath, { withFileTypes: true });

    for (const dirEntry of dirEntries) {
        if (!dirEntry.isFile()) continue;
        const ext = path.extname(dirEntry.name).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) continue;

        const filePath = path.join(folder.localPath, dirEntry.name);
        const stat = await fsp.stat(filePath);
        const contentHash = await hashFile(filePath);

        entries.push({
            contentHash,
            fileName: dirEntry.name,
            mimeType: MIME_MAP[ext] ?? 'application/octet-stream',
            fileSize: stat.size,
            folderName: folder.displayName,
            folderUrl: folder.sharingUrl,
            localPath: filePath,
        });

        process.stderr.write(`  ${dirEntry.name} → ${contentHash.slice(0, 12)}…\n`);
    }

    return entries;
}

async function main() {
    const outputArg = process.argv.indexOf('-o');
    const outputPath = outputArg !== -1 ? process.argv[outputArg + 1] : null;

    const foldersToScan = FOLDERS.filter((f) => f.localPath);
    if (foldersToScan.length === 0) {
        console.error('No folders have localPath configured. Set localPath in packages/server/src/config/folders.config.ts');
        process.exit(1);
    }

    const manifest: Manifest = { scannedAt: new Date().toISOString(), photos: [] };

    for (const folder of foldersToScan) {
        console.error(`Scanning: ${folder.displayName} (${folder.localPath})`);
        const entries = await scanFolder(folder as { displayName: string; sharingUrl: string; localPath: string });
        manifest.photos.push(...entries);
    }

    console.error(`\nDone. ${manifest.photos.length} photos scanned.`);

    const json = JSON.stringify(manifest, null, 2);
    if (outputPath) {
        await fsp.writeFile(outputPath, json, 'utf-8');
        console.error(`Manifest written to ${outputPath}`);
    } else {
        process.stdout.write(json + '\n');
    }
}

main().catch((err) => {
    console.error('Scan failed:', err);
    process.exit(1);
});
