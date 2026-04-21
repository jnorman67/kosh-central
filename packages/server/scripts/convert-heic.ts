#!/usr/bin/env npx tsx
/**
 * Walks a local folder tree (typically a OneDrive-synced directory) and
 * writes a sibling .jpg next to every .heic / .heif file. EXIF metadata and
 * orientation are preserved so date-taken, GPS, and rotation survive the
 * conversion. Never deletes originals unless --delete-originals is passed,
 * and even then only after verifying the sibling opens as a valid JPEG.
 *
 * Uses heic-convert (bundles libde265 for HEVC decode, unlike sharp's
 * prebuilt libheif) and exiftool-vendored to copy EXIF across.
 *
 * Usage:
 *   npx tsx convert-heic.ts <root-path> [--quality 90] [--delete-originals]
 */
import fsp from "node:fs/promises";
import path from "node:path";
import convert from "heic-convert";
import { exiftool } from "exiftool-vendored";

const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);

interface Options {
  rootPath: string;
  quality: number;
  deleteOriginals: boolean;
}

interface Stats {
  converted: number;
  skipped: number;
  deleted: number;
  failed: number;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function convertToJpeg(
  heicPath: string,
  jpgPath: string,
  quality: number,
): Promise<void> {
  const heicBuffer = await fsp.readFile(heicPath);
  const jpegBuffer = await convert({
    buffer: new Uint8Array(heicBuffer),
    format: "JPEG",
    quality, // heic-convert takes 0..1
  });
  await fsp.writeFile(jpgPath, Buffer.from(jpegBuffer));
  // heic-convert drops EXIF during decode, so copy every tag from the HEIC
  // onto the JPEG. -all:all preserves date-taken, GPS, orientation, camera.
  await exiftool.write(
    jpgPath,
    {},
    {
      writeArgs: [
        "-TagsFromFile",
        heicPath,
        "-all:all",
        "-overwrite_original",
      ],
    },
  );
}

async function verifyJpeg(jpgPath: string): Promise<boolean> {
  try {
    const fh = await fsp.open(jpgPath, "r");
    try {
      const buf = Buffer.alloc(3);
      await fh.read(buf, 0, 3, 0);
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    } finally {
      await fh.close();
    }
  } catch {
    return false;
  }
}

async function walkAndConvert(
  rootPath: string,
  currentPath: string,
  options: Options,
  stats: Stats,
): Promise<void> {
  const dirEntries = await fsp.readdir(currentPath, { withFileTypes: true });

  for (const dirEntry of dirEntries) {
    const fullPath = path.join(currentPath, dirEntry.name);

    if (dirEntry.isDirectory()) {
      await walkAndConvert(rootPath, fullPath, options, stats);
      continue;
    }

    if (!dirEntry.isFile()) continue;
    const ext = path.extname(dirEntry.name).toLowerCase();
    if (!HEIC_EXTENSIONS.has(ext)) continue;

    const rel = path.relative(rootPath, fullPath);
    const base = path.basename(dirEntry.name, path.extname(dirEntry.name));
    const jpgPath = path.join(path.dirname(fullPath), `${base}.jpg`);

    if (await exists(jpgPath)) {
      if (options.deleteOriginals && (await verifyJpeg(jpgPath))) {
        await fsp.unlink(fullPath);
        stats.deleted++;
        process.stderr.write(`  ${rel} → sibling exists, original deleted\n`);
      } else {
        stats.skipped++;
        process.stderr.write(`  ${rel} → skipped (sibling exists)\n`);
      }
      continue;
    }

    try {
      await convertToJpeg(fullPath, jpgPath, options.quality);
      stats.converted++;
      process.stderr.write(`  ${rel} → ${base}.jpg\n`);

      if (options.deleteOriginals) {
        if (await verifyJpeg(jpgPath)) {
          await fsp.unlink(fullPath);
          stats.deleted++;
        } else {
          process.stderr.write(
            `  ! ${rel}: verify failed, keeping original\n`,
          );
        }
      }
    } catch (err) {
      stats.failed++;
      process.stderr.write(`  x ${rel}: ${(err as Error).message}\n`);
    }
  }
}

function printUsage(): void {
  console.error("Usage: npx tsx convert-heic.ts <root-path> [options]");
  console.error("");
  console.error(
    "Walks <root-path> recursively. For each .heic/.heif, writes a sibling",
  );
  console.error(".jpg with EXIF preserved (date-taken, GPS, orientation).");
  console.error("");
  console.error("Options:");
  console.error("  --quality <n>        JPEG quality 1-100 (default 90)");
  console.error(
    "  --delete-originals   Delete .heic after verifying the sibling .jpg",
  );
  console.error("");
  console.error("Example:");
  console.error(
    '  npx tsx convert-heic.ts "C:\\Users\\Jim\\OneDrive" --quality 92',
  );
}

async function main() {
  const args = process.argv.slice(2);

  let qualityPct = 90;
  let deleteOriginals = false;

  const qualityIdx = args.indexOf("--quality");
  if (qualityIdx !== -1) {
    qualityPct = Number(args[qualityIdx + 1]);
    if (!Number.isFinite(qualityPct) || qualityPct < 1 || qualityPct > 100) {
      console.error("Error: --quality must be an integer between 1 and 100");
      process.exit(1);
    }
    args.splice(qualityIdx, 2);
  }

  const deleteIdx = args.indexOf("--delete-originals");
  if (deleteIdx !== -1) {
    deleteOriginals = true;
    args.splice(deleteIdx, 1);
  }

  const [rootPath] = args;
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

  const stats: Stats = { converted: 0, skipped: 0, deleted: 0, failed: 0 };
  console.error(`Scanning root: ${rootPath}`);
  console.error(
    `Quality: ${qualityPct}, delete originals: ${deleteOriginals}`,
  );
  console.error("");

  try {
    await walkAndConvert(
      rootPath,
      rootPath,
      { rootPath, quality: qualityPct / 100, deleteOriginals },
      stats,
    );
  } finally {
    // exiftool keeps a subprocess alive; end it so the script can exit.
    await exiftool.end();
  }

  console.error("");
  console.error(
    `Done. converted=${stats.converted} skipped=${stats.skipped} deleted=${stats.deleted} failed=${stats.failed}`,
  );
}

main().catch((err) => {
  console.error("Conversion failed:", err);
  process.exit(1);
});
