#!/usr/bin/env npx tsx
/**
 * Standalone local photo scanner. No server dependencies — runs anywhere
 * with Node.js + tsx (including Windows).
 *
 * Walks a root folder recursively, computes SHA-256 for each image, groups
 * files that share a base name (ignoring suffixes like `_a`/`_b`/`_back`) into
 * "bundles" representing one physical photograph, assigns each file a side
 * (front/back) and a heuristic preferred hint, and writes a JSON manifest.
 *
 * Usage:
 *   npx tsx scan-local.ts <root-path> [-o manifest.json]
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

type Side = "front" | "back";
type Variant = "enhanced" | "original" | "back";

interface ScannedFile {
  contentHash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  folderName: string;
  localPath: string;
}

interface ManifestEntry extends ScannedFile {
  /** Stable identifier that groups files of the same physical photograph. */
  bundleKey: string;
  side: Side;
  /** Scanner's guess at the preferred version for this (bundle, side). */
  preferredHint: boolean;
}

interface Manifest {
  scannedAt: string;
  photos: ManifestEntry[];
}

/**
 * Suffix patterns applied to a basename (extension stripped) to decide its
 * role in a bundle. Order matters: `_back` / `_enhanced` are checked before
 * single-letter `_b` / `_a` so longer matches win.
 */
const SUFFIX_PATTERNS: { pattern: RegExp; variant: Variant }[] = [
  { pattern: /[-_ ]back$/i, variant: "back" },
  { pattern: /[-_ ]enhanced$/i, variant: "enhanced" },
  { pattern: /[-_ ]alt$/i, variant: "enhanced" },
  { pattern: /[-_ ]b$/i, variant: "back" },
  { pattern: /[-_ ]a$/i, variant: "enhanced" },
];

interface ParsedName {
  /** The filename with the variant suffix stripped (still includes no extension). */
  baseName: string;
  variant: Variant | "bare";
}

/**
 * Strip a known suffix from a basename and classify it. A bare name (no
 * recognized suffix) is the "original" front version.
 */
function parseFileName(baseName: string): ParsedName {
  for (const { pattern, variant } of SUFFIX_PATTERNS) {
    if (pattern.test(baseName)) {
      const stripped = baseName.replace(pattern, "");
      if (stripped.length > 0) return { baseName: stripped, variant };
    }
  }
  return { baseName, variant: "bare" };
}

/**
 * Rank fronts so the enhanced variant wins as the default preferred. Lower is
 * better. Ties fall through to alphabetical fileName.
 */
function frontRank(variant: ParsedName["variant"]): number {
  if (variant === "enhanced") return 0;
  if (variant === "bare") return 1;
  return 2;
}

function buildBundles(files: ScannedFile[]): ManifestEntry[] {
  // Group files by (folder, strippedBaseName). Each group becomes one bundle.
  interface GroupMember {
    file: ScannedFile;
    parsed: ParsedName;
  }
  const groups = new Map<string, GroupMember[]>();

  for (const file of files) {
    const ext = path.extname(file.fileName);
    const baseName = path.basename(file.fileName, ext);
    const parsed = parseFileName(baseName);
    const key = `${file.folderName}::${parsed.baseName.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ file, parsed });
  }

  const out: ManifestEntry[] = [];

  for (const [bundleKey, members] of groups) {
    const fronts = members.filter((m) => m.parsed.variant !== "back");
    const backs = members.filter((m) => m.parsed.variant === "back");

    fronts.sort(
      (a, b) =>
        frontRank(a.parsed.variant) - frontRank(b.parsed.variant) ||
        a.file.fileName.localeCompare(b.file.fileName),
    );
    backs.sort((a, b) => a.file.fileName.localeCompare(b.file.fileName));

    fronts.forEach((m, i) => {
      out.push({
        ...m.file,
        bundleKey,
        side: "front",
        preferredHint: i === 0,
      });
    });
    backs.forEach((m, i) => {
      out.push({
        ...m.file,
        bundleKey,
        side: "back",
        preferredHint: i === 0,
      });
    });
  }

  return out;
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
): Promise<ScannedFile[]> {
  const entries: ScannedFile[] = [];
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
  const scanned = await scanFolderRecursive(rootPath, rootPath);
  const photos = buildBundles(scanned);
  const bundleCount = new Set(photos.map((p) => p.bundleKey)).size;
  const manifest: Manifest = {
    scannedAt: new Date().toISOString(),
    photos,
  };

  console.error(
    `\nDone. ${photos.length} photos across ${bundleCount} bundles.`,
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
