# Cowork ↔ kosh-central Contract: Bundle JSON Sidecar Files

This document defines the interface between two AI agents that both work on the Kosh photo archive:

- **Cowork** (Claude in the desktop app) — walks the OneDrive photo folders, enriches each bundle with OCR text, face bounding boxes, photo type classification, and thumbnails, and writes the results as **bundle JSON sidecar files** alongside the photos.
- **Claude Code** (kosh-central server) — reads `kosh-manifest.json` files to populate the SQLite database, and should additionally ingest bundle JSON sidecar files to populate the `ocr_results`, `photo_subjects`, and (once migrated) `photo_type` columns.

Neither agent may rewrite the other's primary output file. See the **Ownership** section.

---

## File Layout

For each OneDrive album folder that contains photos, Cowork writes one JSON sidecar file per bundle (physical photograph). The sidecar lives in the **same folder as the photos it describes**, named after the bundle's local key:

```
album16 - Urban/
  kosh-manifest.json          ← written by scan-local.ts, owned by Claude Code
  FastFoto_1538.json          ← written by Cowork (bundle sidecar)
  FastFoto_1538_a.jpg
  FastFoto_1538_b.jpg
  FastFoto_1539.json
  FastFoto_1539_a.jpg
  ...
  subfolder/
    kosh-manifest.json
    SomeBundle.json
    SomeBundle_a.jpg
```

Sidecar file names follow the same casing and spelling as the canonical base name used in `kosh-manifest.json` entries, with a `.json` extension. The local bundle key (lowercase) used internally matches `bundleKey` in `kosh-manifest.json` entries and `scanner_key` on the `bundles` table (see **Linking Keys** below).

---

## Ownership

| File | Owner | Other agent must |
|---|---|---|
| `kosh-manifest.json` (any folder) | Claude Code (`scan-local.ts`) | **Never overwrite or modify** |
| `*.json` sidecar (any folder, excluding `kosh-manifest.json`) | Cowork | Read freely; never overwrite |
| `face_detection_yunet_2023mar.onnx` (album root) | Cowork tooling dependency | Ignore |

### Folders both agents skip

Both `scan-local.ts` and Cowork skip any folder whose name (case-insensitive) is in this set:

```
archive, archived, ignore, ignored, pages
```

`pages` is specific to this collection — it contains pre-disassembly iPhone shots of whole album pages, not individual photos.

---

## Bundle JSON Schema

```jsonc
{
  // Lowercase local bundle key — matches bundleKey in kosh-manifest.json
  // and the local part of scanner_key in the bundles table (see Linking Keys).
  "bundleKey": "fastfoto_1538",

  // ISO-8601 timestamp when Cowork last processed this bundle.
  "processedAt": "2025-05-24T18:32:11.000Z",

  // One entry per physical file in the bundle (front, back, variants).
  "files": [
    {
      // Exact file name as it appears on disk and in kosh-manifest.json.
      "fileName": "FastFoto_1538_a.jpg",

      // "front" | "back" — matches side in kosh-manifest.json.
      "side": "front",

      // Photograph format classification (see Photo Types below).
      "photoType": "snapshot",

      // SHA-256 hex digest of the file bytes — sourced from kosh-manifest.json,
      // never independently recomputed by Cowork. Matches contentHash there.
      "checksum": "a3f8...",
      "checksumAlgorithm": "sha256",

      // 64×64 PNG, white-padded, base64-encoded.
      // Suitable for use as a DB thumbnail if the server's copy is absent.
      "thumbnail64": "<base64>",

      // OCR results from Anthropic Vision.
      "ocr": {
        "has_text": true,
        "confidence": 0.91,
        // Full extracted text, or "" if has_text is false.
        "text": "Back row: Uncle Ed, ..."
      },

      // Face bounding boxes detected by OpenCV YuNet (face_detection_yunet_2023mar.onnx).
      // Empty array when no faces detected.
      // All values are normalized [0.0, 1.0] relative to display-oriented image dimensions
      // (EXIF rotation already applied). x,y = top-left corner; w,h = width/height.
      "faces": [
        { "x": 0.0982, "y": 0.1289, "w": 0.0943, "h": 0.1513 },
        { "x": 0.6651, "y": 0.1656, "w": 0.0812, "h": 0.1312 }
      ]
    },
    {
      "fileName": "FastFoto_1538_b.jpg",
      "side": "back",
      "photoType": "snapshot",
      "checksum": "b7c1...",
      "checksumAlgorithm": "sha256",
      "thumbnail64": "<base64>",
      "ocr": {
        "has_text": true,
        "confidence": 0.87,
        "text": "Christmas 1954"
      },
      "faces": []
    }
  ]
}
```

### Photo Types

Valid `photoType` values and their meanings:

| Value | Description |
|---|---|
| `cdv` | Carte de visite — small albumen print mounted on card (~2.5×4 in) |
| `cabinet_card` | Cabinet card — larger albumen/gelatin print on card (~4×6.5 in) |
| `rppc` | Real photo postcard — silver gelatin print on postcard stock |
| `tintype` | Tintype (ferrotype) — image on thin iron sheet |
| `snapshot` | 20th-century amateur snapshot (Kodak era onward) |
| `hand_colored` | Any format that has been hand-colored |
| `newspaper_clipping` | Clipping from a newspaper or magazine |
| `portrait_print` | Studio portrait print (larger format, not cabinet card) |
| `unknown` | Format could not be determined |

---

## Linking Keys

The `bundleKey` field in a sidecar file is the **bare local key** — lowercase, no folder path prefix. For example: `fastfoto_1538`.

The `bundles` table stores a `scanner_key` column that is the **absolute key** produced by `manifest-sync.service.ts` during import:

```
scanner_key = "<absoluteFolderPath>::<localBundleKey>"
```

For example:
```
Dorothy's albums/album16 - Urban::fastfoto_1538
```

To look up a bundle in SQLite given a sidecar file, Claude Code must reconstruct the absolute key from the sidecar's location:

```typescript
// sidecarPath: absolute path to the sidecar file on disk / in OneDrive
// sidecar.bundleKey: e.g. "fastfoto_1538"
const folderPath = path.dirname(sidecarPath);       // absolute folder path
const scannerKey = `${folderPath}::${sidecar.bundleKey}`;
const bundle = db.prepare('SELECT * FROM bundles WHERE scanner_key = ?').get(scannerKey);
```

The sidecar should only be ingested **after** the corresponding `kosh-manifest.json` has been synced, so the bundle row already exists.

---

## How Claude Code Should Ingest Sidecar Files

The server should expose an **import-sidecars** flow (script or admin endpoint) that:

1. Walks the same OneDrive folder tree used by `ManifestSyncService`, applying the same folder-skip rules.
2. For each `*.json` file that is **not** `kosh-manifest.json`, parses it as a bundle sidecar.
3. Looks up the bundle by reconstructed `scanner_key` (see above). If not found, skip (manifest not yet synced).
4. For each `files[]` entry in the sidecar:

   **OCR** → upsert into `ocr_results`:
   ```sql
   INSERT INTO ocr_results (id, bundle_id, text, ran_at)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(bundle_id) DO UPDATE SET text = excluded.text, ran_at = excluded.ran_at
   ```
   Use the concatenated text of all files where `ocr.has_text = true`, joined by `\n\n`.

   **Faces** → for each box in `faces[]`, insert a row into `photo_subjects` with:
   - `bundle_id`: the resolved bundle UUID
   - `person_id`: NULL (Cowork detects faces but does not identify people)
   - `source`: `"cowork-yunet"`
   - `confidence`: NULL (YuNet score not stored in sidecar; use 1.0 as placeholder)
   - `face_region`: JSON string of the normalized box `{"x":…,"y":…,"w":…,"h":…}`
   - `verified`: 0

   Before inserting, delete any existing `cowork-yunet` rows for the same bundle to allow clean re-import.

5. **Photo type** — the `bundles` table does not yet have a `photo_type` column. A migration is needed:
   ```sql
   ALTER TABLE bundles ADD COLUMN photo_type TEXT
     CHECK(photo_type IN ('cdv','cabinet_card','rppc','tintype','snapshot',
                          'hand_colored','newspaper_clipping','portrait_print','unknown'));
   ```
   After migration, set `photo_type` on the bundle row to the `photoType` from the front-side file entry (or any entry if there is no front side).

6. **Thumbnails** — `thumbnail64` in the sidecar is a 64×64 PNG. The server stores thumbnails as BLOBs on the `photos` table (`thumbnail` column, added in migration ~1459). If a photo row has a NULL thumbnail, Claude Code may decode `thumbnail64` and write it. Do not overwrite an existing non-null thumbnail.

---

## Stability Guarantees

Cowork commits to:
- **Never removing** fields listed in this schema from sidecar files it writes.
- **Always including** `bundleKey`, `processedAt`, and `files[]` with at minimum `fileName`, `side`, `checksum`, `checksumAlgorithm`, and `faces` in every file.
- **Backward-compatible additions only**: new fields may appear; existing fields will not change type or be renamed.
- **Idempotent re-runs**: re-processing a bundle overwrites its sidecar in place. The `processedAt` timestamp updates; all data fields are recomputed from the current image files.

Claude Code commits to:
- **Never writing** sidecar `*.json` files (other than `kosh-manifest.json`).
- Treating sidecar import as **idempotent**: running it twice on the same folder produces the same DB state.
- Preserving the `scanner_key` ↔ `bundleKey` linkage convention described above.

---

## Current State (as of 2026-05-25)

- **album16 - Urban** (root folder): 138 bundle JSON sidecar files written, covering 186 image files.
  - All files have: `bundleKey`, `processedAt`, `files[]` with `fileName`, `side`, `photoType`, `checksum`, `checksumAlgorithm`, `thumbnail64`, `ocr`, `faces`.
  - Face detection uses OpenCV YuNet (`face_detection_yunet_2023mar.onnx`, confidence threshold 0.6, 20% padding). Model file lives at the album root — Claude Code does not need it.
  - Total faces detected across all bundles: 513.
- **Subfolder bundles**: not yet processed by Cowork. Subfolders in album16 - Urban (other than `archive`, `archived`, `pages`) still need sidecar files written.
- **Other albums**: no sidecar files written yet.
