#!/usr/bin/env npx tsx
/**
 * Standalone local photo scanner. No server dependencies — runs anywhere
 * with Node.js + tsx (including Windows).
 *
 * Walks a folder, computes SHA-256 for each image, and writes a JSON manifest.
 *
 * Usage:
 *   npx tsx scan-local.ts <folder-path> <folder-name> [-o manifest.json]
 *
 * Examples:
 *   npx tsx scan-local.ts "C:\Users\Jim\OneDrive\Dorothy's Album 18" "Dorothy's Album 18" -o manifest.json
 *   npx tsx scan-local.ts /home/jim/OneDrive/Album "Dorothy's Album 18"
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

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
    localPath: string;
}

interface Manifest {
    scannedAt: string;
    photos: ManifestEntry[];
}

function hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

async function scanFolder(folderPath: string, folderName: string): Promise<ManifestEntry[]> {
    const entries: ManifestEntry[] = [];
    const dirEntries = await fsp.readdir(folderPath, { withFileTypes: true });

    for (const dirEntry of dirEntries) {
        if (!dirEntry.isFile()) continue;
        const ext = path.extname(dirEntry.name).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) continue;

        const filePath = path.join(folderPath, dirEntry.name);
        const stat = await fsp.stat(filePath);
        const contentHash = await hashFile(filePath);

        entries.push({
            contentHash,
            fileName: dirEntry.name,
            mimeType: MIME_MAP[ext] ?? 'application/octet-stream',
            fileSize: stat.size,
            folderName,
            localPath: filePath,
        });

        process.stderr.write(`  ${dirEntry.name} → ${contentHash.slice(0, 12)}…\n`);
    }

    return entries;
}

function printUsage(): void {
    console.error('Usage: npx tsx scan-local.ts <folder-path> <folder-name> [-o output.json]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx scan-local.ts "C:\\Users\\Jim\\OneDrive\\Album 18" "Dorothy\'s Album 18" -o manifest.json');
}

async function main() {
    const args = process.argv.slice(2);
    const outputIdx = args.indexOf('-o');

    let outputPath: string | null = null;
    if (outputIdx !== -1) {
        outputPath = args[outputIdx + 1];
        args.splice(outputIdx, 2); // remove -o and its value from args
    }

    const [folderPath, folderName] = args;

    if (!folderPath || !folderName) {
        printUsage();
        process.exit(1);
    }

    // Verify folder exists
    try {
        const stat = await fsp.stat(folderPath);
        if (!stat.isDirectory()) {
            console.error(`Error: ${folderPath} is not a directory`);
            process.exit(1);
        }
    } catch {
        console.error(`Error: cannot access ${folderPath}`);
        process.exit(1);
    }

    console.error(`Scanning: ${folderName} (${folderPath})`);
    const photos = await scanFolder(folderPath, folderName);
    const manifest: Manifest = { scannedAt: new Date().toISOString(), photos };

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
