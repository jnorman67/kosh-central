# Kosh Central Operations Guide

## Guiding principle: archive across the ages

This system is intended to preserve family history for a very long time.
That shapes every design decision:

- Prefer **simple, durable formats** over clever ones.  Plain JSON, plain SQL,
  standard image files.
- Prefer **explicit identifiers** over positional or implicit ones.  A face box
  should be linked to a person by a stable DB key, not by its index in a list.
- Prefer **additive changes** over destructive ones.  Importing new analysis
  results should not silently overwrite human-curated data.
- Keep **tooling and formats legible** to a future maintainer who wasn't here
  when decisions were made.

### What lives where

**Sidecar JSON files** (`<bundle>.json` alongside the photos) are an
**analysis pipeline** — Cowork runs OCR, face detection, and photo-type
classification outside the web app and writes the results as importable JSON.
They are an *input* to the DB, not a mirror of it.

**The database** is the system of record once data has been imported and
enriched by humans — person identities, face-to-person assignments, comments,
ratings, series memberships.  None of that lives in the sidecar files.

**The photo files and `kosh-manifest.json`** are the stable foundation.
Photos are identified by SHA-256 hash, so renames and moves don't corrupt
associations.  Thumbnails are embedded in sidecars so a future human (or AI)
can visually confirm which bundle a sidecar belongs to, even without a working
server.

The DB is backed up continuously (Litestream → Azure Blob Storage in
production).  The sidecar files live in OneDrive and are durable on their own
terms.

---

## Roles

| Who | Tool | Responsibilities |
|---|---|---|
| **You** | Claude Cowork | Process photo folders: OCR, face detection, photo-type classification, write sidecar JSONs |
| **You** | Command line (Node) | Run `scan-local.ts` to generate/update `kosh-manifest.json` after any folder changes |
| **Claude Code** | kosh-central repo | Build and maintain the server, DB schema, sidecar importer, deployment |

---

## Setting up a new album folder

### Step 1 — Scan (command line)

Run this once after photos land in a folder, and again any time files are
added, removed, or renamed:

```bash
cd kosh-central
npx tsx packages/server/scripts/scan-local.ts "C:\path\to\album-folder"
```

This writes (or updates) `kosh-manifest.json` in each subfolder that contains
images.  It skips folders named `archive`, `archived`, `ignore`, `ignored`.

> **Do not rename or delete `kosh-manifest.json`.**  The server uses it to
> discover photos; the sidecars reference its checksums.

### Step 2 — Process sidecars (Cowork)

Open Cowork, give it access to the album folder, and ask it to:

1. **Generate bundle JSON sidecars** — one per bundle, named after the bundle
   key (e.g. `FastFoto_1538.json`).  Each sidecar includes:
   - OCR text from the front and back
   - Face bounding boxes (YuNet, normalized 0–1 coordinates, EXIF-corrected)
   - Photo-type classification (`snapshot`, `cabinet_card`, `rppc`, etc.)
   - SHA-256 checksum sourced from `kosh-manifest.json`
   - Embedded 64×64 thumbnail

2. **Skip `pages` folders** — these contain pre-disassembly iPhone shots of
   whole album pages and are a different content type.  Cowork does not write
   sidecars for them (no OCR, face detection, or thumbnails).  The server may
   still index images in these folders via `kosh-manifest.json`.

> **Required model file:** copy
> `packages/server/scripts/models/face_detection_yunet_2023mar.onnx` into
> the album root before running face detection.  Cowork looks for it there.

> **Thumbnail script:** `packages/server/scripts/generate_thumbnails.py`
> can backfill `thumbnail64` into existing sidecars if needed:
> ```bash
> python generate_thumbnails.py /path/to/album-folder --recursive
> ```

### Step 3 — Import into DB (Claude Code)

*The sidecar importer is not yet written.*  Once built, it will:

- Read each `*.json` sidecar (excluding `kosh-manifest.json`)
- Look up the matching bundle via `scanner_key`
- Upsert OCR text into `ocr_results`
- Insert face boxes into `photo_subjects` (source `"cowork-yunet"`, no person ID yet)
- Set `bundles.photo_type` from the front-side file's `photoType`
- Backfill any missing `photos.thumbnail` BLOBs from `thumbnail64`

See [photo-metadata-schema.md](photo-metadata-schema.md) for the full
import spec.

---

## Maintaining an existing album

### Photos added or renamed
Re-run `scan-local.ts` on the affected folder, then open Cowork and ask it
to process the new or changed bundles.  Existing sidecars for unchanged
bundles are skipped (checksum match).

### Photos deleted
Re-run `scan-local.ts`.  The updated manifest removes the stale entries;
the server's next sync cleans them from the DB automatically.  The sidecar
for the deleted bundle can be left in place (it becomes an orphan but causes
no harm) or manually deleted.

### Folder structure changes
If you reorganize folders or rename them, re-run `scan-local.ts` from the
new root so `kosh-manifest.json` files reflect the new structure.  The DB
re-associates photos by content hash, so no data is lost as long as the
photo bytes themselves don't change.

### Re-running Cowork on an already-processed folder
Safe to do at any time — each sidecar is overwritten in place with fresh
results.  `processedAt` updates; all fields are recomputed.

---

## Recovery scenarios

### DB wiped or corrupted
Restore from a Litestream backup — that recovers everything.  If no backup
is available:

1. Re-run `scan-local.ts` on all album folders.
2. Trigger a server manifest sync (Admin → Sync, or `POST /api/admin/sync`).
3. Run the sidecar importer once it exists.

This recovers the photo catalog, OCR text, detected face boxes (without person
assignments), photo types, and thumbnails.  **It does not recover** person
identities, person-to-face assignments, comments, ratings, or series
memberships — always prefer restoring from backup.

### Sidecar separated from its photos
The embedded `thumbnail64` (64×64 PNG, base64) in each file entry provides
a visual fingerprint.  A human or AI can match it against the photo bytes
to re-establish the association.  The `checksum` field (SHA-256) provides
the definitive match once you find the right file.

### `kosh-manifest.json` lost or corrupted
Re-run `scan-local.ts` on that folder.  Existing sidecar checksums were
sourced from the original manifest; re-scanning regenerates matching hashes
from the same photo bytes, so sidecar `checksum` values remain valid.

---

## What to watch for

- **Don't move photos outside of OneDrive** — the server discovers them via
  Graph API.  Local-only copies won't be synced.
- **Don't rename `kosh-manifest.json`** — the server looks for exactly that
  name.
- **Don't let the app write sidecars** — that's Cowork's domain.  If Claude
  Code is ever tempted to write a `*.json` file in a photo folder (other than
  `kosh-manifest.json`), that's a contract violation.
- **Keep `SKIP_FOLDER_NAMES` in sync** — the hard-skip list in `scan-local.ts`
  and Cowork must agree.  Current set: `archive`, `archived`, `ignore`,
  `ignored`.  `pages` is different — Cowork skips sidecar processing for it,
  but the scanner and server may still index images there.
- **Checksums in sidecars come from the manifest** — Cowork never
  independently hashes files.  If a photo file is edited in place (e.g.
  rotated), the hash changes; re-run scan-local.ts, then ask Cowork to
  reprocess that bundle.

---

## File reference

```
OneDrive album folder/
  kosh-manifest.json          ← scan-local.ts output; server reads this
  FastFoto_1538.json          ← Cowork sidecar; server imports this
  FastFoto_1538_a.jpg
  FastFoto_1538_b.jpg
  face_detection_yunet_2023mar.onnx   ← model file needed by Cowork (copy from repo)

kosh-central/
  docs/
    operations.md             ← this file
    photo-metadata-schema.md  ← JSON contract between Cowork and server
  packages/server/
    scripts/
      scan-local.ts           ← generates kosh-manifest.json
      generate_thumbnails.py  ← backfills thumbnail64 in sidecars
      models/
        face_detection_yunet_2023mar.onnx   ← master copy of model file
    src/
      services/manifest-sync.service.ts  ← server-side manifest importer
      db/
        photos.store.ts       ← importManifest()
        bundles.store.ts      ← upsertBundleByScannerKey()
        ocr.store.ts          ← upsertOcr()
```
