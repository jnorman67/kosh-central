#!/usr/bin/env npx tsx
/**
 * Standalone local photo scanner. No server dependencies — runs anywhere
 * with Node.js + tsx (including Windows).
 *
 * Walks a root folder recursively, computes SHA-256 for each image, detects
 * front/back and original/enhanced relations from filename conventions, and
 * writes a JSON manifest. Each photo's `folderName` is its directory path
 * relative to the scan root (using forward slashes for cross-platform match).
 *
 * Usage:
 *   npx tsx scan-local.ts <root-path> [-o manifest.json]
 *
 * Examples:
 *   npx tsx scan-local.ts "C:\Users\Jim\OneDrive" -o manifest.json
 *   npx tsx scan-local.ts /home/jim/OneDrive
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".tiff",
  ".tif",
  ".bmp",
  ".heic",
  ".heif",
]);

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

interface ManifestEntry {
  contentHash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  folderName: string;
  localPath: string;
}

interface ManifestRelation {
  sourceHash: string;
  targetHash: string;
  relationType: "back-of" | "enhanced-version-of";
}

interface Manifest {
  scannedAt: string;
  photos: ManifestEntry[];
  relations: ManifestRelation[];
}

/** Suffix patterns that indicate a relationship to the base-named photo. */
const SUFFIX_PATTERNS: {
  pattern: RegExp;
  relationType: ManifestRelation["relationType"];
}[] = [
  { pattern: /[-_ ]b$/i, relationType: "back-of" },
  { pattern: /[-_ ]back$/i, relationType: "back-of" },
  { pattern: /[-_ ]a$/i, relationType: "enhanced-version-of" },
  { pattern: /[-_ ]alt$/i, relationType: "enhanced-version-of" },
  { pattern: /[-_ ]enhanced$/i, relationType: "enhanced-version-of" },
];

/**
 * Given a filename (without extension), check if it ends with a known suffix.
 * Returns the base name and relation type, or null if no match.
 */
function parseSuffix(
  baseName: string,
): {
  strippedName: string;
  relationType: ManifestRelation["relationType"];
} | null {
  for (const { pattern, relationType } of SUFFIX_PATTERNS) {
    if (pattern.test(baseName)) {
      const strippedName = baseName.replace(pattern, "");
      if (strippedName.length > 0) {
        return { strippedName, relationType };
      }
    }
  }
  return null;
}

/**
 * Detect relationships between photos based on filename conventions.
 * E.g. "photo001_b.jpg" is the back of "photo001.jpg".
 *
 * Pairs are scoped to each immediate directory (folderName) so unrelated
 * photos in different albums that happen to share a base name aren't paired.
 */
function detectRelations(entries: ManifestEntry[]): ManifestRelation[] {
  // Lookup keyed by `${folderName}::${baseName.toLowerCase()}`
  const byFolderAndBase = new Map<string, ManifestEntry>();
  for (const entry of entries) {
    const ext = path.extname(entry.fileName);
    const baseName = path.basename(entry.fileName, ext);
    byFolderAndBase.set(
      `${entry.folderName}::${baseName.toLowerCase()}`,
      entry,
    );
  }

  const relations: ManifestRelation[] = [];

  for (const entry of entries) {
    const ext = path.extname(entry.fileName);
    const baseName = path.basename(entry.fileName, ext);
    const parsed = parseSuffix(baseName);
    if (!parsed) continue;

    const target = byFolderAndBase.get(
      `${entry.folderName}::${parsed.strippedName.toLowerCase()}`,
    );
    if (!target || target.contentHash === entry.contentHash) continue;

    relations.push({
      sourceHash: entry.contentHash,
      targetHash: target.contentHash,
      relationType: parsed.relationType,
    });

    process.stderr.write(
      `  ↳ ${entry.folderName}/${entry.fileName} → ${parsed.relationType} → ${target.fileName}\n`,
    );
  }

  return relations;
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function scanFolderRecursive(
  rootPath: string,
  currentPath: string,
): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = [];
  const dirEntries = await fsp.readdir(currentPath, { withFileTypes: true });

  for (const dirEntry of dirEntries) {
    const fullPath = path.join(currentPath, dirEntry.name);

    if (dirEntry.isDirectory()) {
      const subEntries = await scanFolderRecursive(rootPath, fullPath);
      entries.push(...subEntries);
      continue;
    }

    if (!dirEntry.isFile()) continue;
    const ext = path.extname(dirEntry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    const stat = await fsp.stat(fullPath);
    const contentHash = await hashFile(fullPath);
    // Folder name is the file's containing dir, relative to the scan root,
    // normalized to forward slashes for cross-platform consistency.
    const folderName = path
      .relative(rootPath, currentPath)
      .split(path.sep)
      .join("/");

    entries.push({
      contentHash,
      fileName: dirEntry.name,
      mimeType: MIME_MAP[ext] ?? "application/octet-stream",
      fileSize: stat.size,
      folderName,
      localPath: fullPath,
    });

    const display = folderName
      ? `${folderName}/${dirEntry.name}`
      : dirEntry.name;
    process.stderr.write(`  ${display} → ${contentHash.slice(0, 12)}…\n`);
  }

  return entries;
}

function printUsage(): void {
  console.error("Usage: npx tsx scan-local.ts <root-path> [-o output.json]");
  console.error("");
  console.error(
    "Walks <root-path> recursively. Each photo's folderName is its",
  );
  console.error("containing directory relative to <root-path>.");
  console.error("");
  console.error("Example:");
  console.error(
    '  npx tsx scan-local.ts "C:\\Users\\Jim\\OneDrive" -o manifest.json',
  );
}

async function main() {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf("-o");

  let outputPath: string | null = null;
  if (outputIdx !== -1) {
    outputPath = args[outputIdx + 1];
    args.splice(outputIdx, 2); // remove -o and its value from args
  }

  const [rootPath] = args;

  if (!rootPath) {
    printUsage();
    process.exit(1);
  }

  // Verify root exists
  try {
    const stat = await fsp.stat(rootPath);
    if (!stat.isDirectory()) {
      console.error(`Error: ${rootPath} is not a directory`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: cannot access ${rootPath}`);
    process.exit(1);
  }

  console.error(`Scanning root: ${rootPath}`);
  const photos = await scanFolderRecursive(rootPath, rootPath);
  const relations = detectRelations(photos);
  const manifest: Manifest = {
    scannedAt: new Date().toISOString(),
    photos,
    relations,
  };

  console.error(
    `\nDone. ${manifest.photos.length} photos scanned, ${relations.length} relations detected.`,
  );

  const json = JSON.stringify(manifest, null, 2);
  if (outputPath) {
    await fsp.writeFile(outputPath, json, "utf-8");
    console.error(`Manifest written to ${outputPath}`);
  } else {
    process.stdout.write(json + "\n");
  }
}

main().catch((err) => {
  console.error("Scan failed:", err);
  process.exit(1);
});
