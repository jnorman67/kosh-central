#!/usr/bin/env npx tsx
/**
 * Standalone local photo scanner. No server dependencies — runs anywhere
 * with Node.js + tsx (including Windows).
 *
 * Walks a root folder recursively, computes SHA-256 for each image, groups
 * files that share a base name (ignoring suffixes like `_a`/`_b`/`_back`) into
 * "bundles" representing one physical photograph, assigns each file a side
 * (front/back) and a heuristic preferred hint, and writes a kosh-manifest.json
 * into each folder containing photos.
 *
 * OneDrive sync automatically pushes the written manifest files to the cloud,
 * where the server picks them up via the Graph API.
 *
 * Usage:
 *   npx tsx scan-local.ts <root-path> [--dry-run]
 *
 * Flags:
 *   --dry-run   Scan and hash files but do not write any kosh-manifest.json files.
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

/** Folder names (case-insensitive) that are silently skipped. */
const SKIP_FOLDER_NAMES = new Set(["archive", "archived", "ignore", "ignored"]);

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

interface FolderManifest {
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
  baseName: string;
  variant: Variant | "bare";
}

function parseFileName(baseName: string): ParsedName {
  for (const { pattern, variant } of SUFFIX_PATTERNS) {
    if (pattern.test(baseName)) {
      const stripped = baseName.replace(pattern, "");
      if (stripped.length > 0) return { baseName: stripped, variant };
    }
  }
  return { baseName, variant: "bare" };
}

/** Lower rank = higher preference. Ties fall through to alphabetical fileName. */
function frontRank(variant: ParsedName["variant"]): number {
  if (variant === "enhanced") return 0;
  if (variant === "bare") return 1;
  return 2;
}

function buildBundles(files: ScannedFile[]): ManifestEntry[] {
  interface GroupMember {
    file: ScannedFile;
    parsed: ParsedName;
  }
  const groups = new Map<string, GroupMember[]>();

  for (const file of files) {
    const ext = path.extname(file.fileName);
    const baseName = path.basename(file.fileName, ext);
    const parsed = parseFileName(baseName);
    // Group key includes folderName so subfolders within one scan stay separate,
    // but the emitted bundleKey is local-only — the server prepends the absolute path.
    const key = `${file.folderName}::${parsed.baseName.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ file, parsed });
  }

  const out: ManifestEntry[] = [];

  for (const [, members] of groups) {
    const localBundleKey = members[0].parsed.baseName.toLowerCase();
    const fronts = members.filter((m) => m.parsed.variant !== "back");
    const backs = members.filter((m) => m.parsed.variant === "back");

    fronts.sort(
      (a, b) =>
        frontRank(a.parsed.variant) - frontRank(b.parsed.variant) ||
        a.file.fileName.localeCompare(b.file.fileName),
    );
    backs.sort((a, b) => a.file.fileName.localeCompare(b.file.fileName));

    // folderName is omitted (empty) — the manifest is relative to its own folder.
    // The server derives the absolute folder path from where it finds the manifest.
    fronts.forEach((m, i) => {
      out.push({ ...m.file, folderName: "", bundleKey: localBundleKey, side: "front", preferredHint: i === 0 });
    });
    backs.forEach((m, i) => {
      out.push({ ...m.file, folderName: "", bundleKey: localBundleKey, side: "back", preferredHint: i === 0 });
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

interface ScanStats {
  photos: number;
  bundles: number;
  folders: number;
}

async function scanFolder(
  rootPath: string,
  currentPath: string,
  dryRun: boolean,
  stats: ScanStats,
): Promise<void> {
  const folderName = path
    .relative(rootPath, currentPath)
    .split(path.sep)
    .join("/");

  const dirBasename = path.basename(currentPath).toLowerCase();
  if (SKIP_FOLDER_NAMES.has(dirBasename)) {
    process.stderr.write(`  [skip] ${folderName || "."}\n`);
    return;
  }

  const dirEntries = await fsp.readdir(currentPath, { withFileTypes: true });
  const localFiles: ScannedFile[] = [];
  const subdirs: string[] = [];

  for (const entry of dirEntries) {
    if (entry.isDirectory()) {
      subdirs.push(path.join(currentPath, entry.name));
      continue;
    }
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    const fullPath = path.join(currentPath, entry.name);
    const stat = await fsp.stat(fullPath);
    const mimeType = MIME_MAP[ext] ?? "application/octet-stream";
    const contentHash = await hashFile(fullPath);
    const display = folderName ? `${folderName}/${entry.name}` : entry.name;
    process.stderr.write(`  ${display} → ${contentHash.slice(0, 12)}…\n`);

    localFiles.push({
      contentHash,
      fileName: entry.name,
      mimeType,
      fileSize: stat.size,
      folderName,
      localPath: fullPath,
    });
  }

  if (localFiles.length > 0) {
    const photos = buildBundles(localFiles);
    const bundleCount = new Set(photos.map((p) => p.bundleKey)).size;
    const manifest: FolderManifest = {
      scannedAt: new Date().toISOString(),
      photos,
    };
    const manifestPath = path.join(currentPath, "kosh-manifest.json");

    if (dryRun) {
      process.stderr.write(
        `  [dry-run] would write ${manifestPath} (${photos.length} photos, ${bundleCount} bundles)\n`,
      );
    } else {
      await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
      process.stderr.write(
        `  → ${manifestPath} (${photos.length} photos, ${bundleCount} bundles)\n`,
      );
    }

    stats.photos += photos.length;
    stats.bundles += bundleCount;
    stats.folders += 1;
  }

  for (const subdir of subdirs) {
    await scanFolder(rootPath, subdir, dryRun, stats);
  }
}

function printUsage(): void {
  console.error("Usage: npx tsx scan-local.ts <root-path> [--dry-run]");
  console.error("");
  console.error(
    "Walks <root-path> recursively. Writes a kosh-manifest.json into each",
  );
  console.error(
    "folder that contains images. OneDrive sync pushes the files to the cloud.",
  );
  console.error("");
  console.error("  --dry-run   Hash files and report without writing manifests.");
  console.error("");
  console.error("Example:");
  console.error('  npx tsx scan-local.ts "C:\\Users\\Jim\\OneDrive\\Photos"');
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "");
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((a) => !a.startsWith("--"));
  const [rootPath] = positional;

  if (!rootPath) {
    printUsage();
    process.exit(1);
  }

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

  if (dryRun) process.stderr.write("[dry-run mode — no files will be written]\n\n");
  process.stderr.write(`Scanning: ${rootPath}\n\n`);

  const stats: ScanStats = { photos: 0, bundles: 0, folders: 0 };
  await scanFolder(rootPath, rootPath, dryRun, stats);

  process.stderr.write(
    `\nDone. ${stats.photos} photos, ${stats.bundles} bundles across ${stats.folders} folders.\n`,
  );
}

main().catch((err) => {
  console.error("Scan failed:", err);
  process.exit(1);
});
