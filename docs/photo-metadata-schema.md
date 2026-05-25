# Photo Metadata Schema

This document defines the JSON contract between **photo-analysis producers** and
the **server importer**. Two producers exist today:

- **Local scanner** ([scan-local.ts](../packages/server/scripts/scan-local.ts)) —
  walks OneDrive folders, hashes files, groups them into bundles, and writes
  one **folder manifest** (`kosh-manifest.json`) per folder.
- **Cowork** (Claude in the desktop app) — reads photo bytes, runs OCR, face
  detection, and photo-type classification, and writes one **bundle sidecar**
  (`<bundleKey>.json`) per physical photograph.

Both feed the importer in
[photos.store.ts](../packages/server/src/db/photos.store.ts).

## Ownership

| File                                          | Owner          | Other producer must  |
|-----------------------------------------------|----------------|----------------------|
| `kosh-manifest.json` (any folder)             | Local scanner  | Never overwrite      |
| `*.json` sidecar (excluding `kosh-manifest`)  | Cowork         | Never overwrite      |
| `face_detection_yunet_2023mar.onnx`           | Cowork tooling | Ignore               |

The model file lives at
`packages/server/scripts/models/face_detection_yunet_2023mar.onnx` in the
repo and should be copied to the album folder before running face detection.
The companion thumbnail script lives at
`packages/server/scripts/generate_thumbnails.py`.

Neither producer rewrites the other's primary output. The server reads both
and never writes either back.

## Folders skipped

### Hard skip — both producers ignore entirely

Case-insensitive folder name match:

```
archive, archived, ignore, ignored
```

### Cowork sidecar skip — `pages`

Folders named `pages` contain pre-disassembly iPhone shots of whole album
pages, not individual photos. Cowork does not write sidecar JSONs for them
(no OCR, face detection, or thumbnails). The local scanner and server may
still index images in these folders via `kosh-manifest.json` — `pages` is a
different content type, not a folder to be ignored entirely.

## Versioning

Every file SHOULD include a top-level `schemaVersion: 1`. The importer treats
missing `schemaVersion` as `1` for backward compatibility and rejects unknown
major versions. Add fields freely within a version; bump the major only for
breaking changes (renames, removals, type changes).

## Bundling rules (authoritative)

A *bundle* is one physical photograph. Files belong to the same bundle when
they share a base name with one of these recognized suffixes stripped:

| Suffix (case-insensitive) | Side    | Notes                                  |
|---------------------------|---------|----------------------------------------|
| `_a`                      | `front` | Epson FastFoto front scan              |
| `_b`                      | `back`  | Epson FastFoto back scan               |
| `_back`                   | `back`  | Manual back scan                       |
| `_enhanced`               | `front` | FastFoto enhanced variant of the front |
| `_original`               | `front` | FastFoto unenhanced variant            |
| *(none)*                  | `front` | Single-file bundle                     |

### Linking keys

Two related identifiers — easy to confuse, important to keep straight:

| Term              | Where it lives                                      | Format                                    | Example                                       |
|-------------------|-----------------------------------------------------|-------------------------------------------|-----------------------------------------------|
| **local key**     | `kosh-manifest.json` `bundleKey`, sidecar filename, sidecar `bundleKey` | Lowercase base name after suffix/ext strip | `fastfoto_1538`                               |
| **scanner_key**   | `bundles.scanner_key` in SQLite                     | `<absoluteFolderPath>::<localKey>`        | `Dorothy's albums/album16 - Urban::fastfoto_1538` |

The same local key in two different folders represents two different physical
photographs. The server prepends the absolute folder path to disambiguate.

To look up a bundle from a sidecar file:

```typescript
const folderPath = path.dirname(sidecarPath);
const scannerKey = `${folderPath}::${sidecar.bundleKey}`;
const bundle = db.prepare('SELECT * FROM bundles WHERE scanner_key = ?').get(scannerKey);
```

Sidecars should only be ingested **after** the corresponding `kosh-manifest.json`
has been synced, so the bundle row already exists. Sidecars with no matching
bundle are deferred (logged), not errored.

## Folder manifest (`kosh-manifest.json`)

Written into each OneDrive folder that contains photos. One per folder.

```json
{
  "schemaVersion": 1,
  "scannedAt": "2026-05-21T14:32:00Z",
  "photos": [ /* PhotoEntry */ ]
}
```

| Field           | Type     | Required | Description                                    |
|-----------------|----------|----------|------------------------------------------------|
| `schemaVersion` | integer  | no¹      | Always `1`.                                    |
| `scannedAt`     | ISO 8601 | yes      | When the scanner processed this folder.        |
| `photos`        | array    | yes      | One `PhotoEntry` per image file in the folder. |

¹ Optional today for backward compatibility with existing manifests.

### `PhotoEntry`

| Field            | Type    | Required | Description                                                                 |
|------------------|---------|----------|-----------------------------------------------------------------------------|
| `contentHash`    | string  | yes      | SHA-256 hex of file bytes. Lowercase. Primary dedup key.                    |
| `fileName`       | string  | yes      | Base name with extension (e.g. `FastFoto_1538_a.jpg`).                      |
| `mimeType`       | string  | yes      | MIME type (`image/jpeg`, `image/png`, …).                                   |
| `fileSize`       | integer | yes      | File size in bytes.                                                         |
| `folderName`     | string  | yes      | Empty in the manifest as written; the server fills this from the manifest's location during import. |
| `bundleKey`      | string  | no       | Local key (see [Linking keys](#linking-keys)).                              |
| `side`           | enum    | cond.    | `front` or `back`. Required iff `bundleKey` is set.                         |
| `preferredHint`  | boolean | no       | Scanner's guess at the preferred file for this `(bundleKey, side)`.         |
| `takenAt`        | ISO 8601| no       | Capture date from EXIF, if known.                                           |
| `folderUrl`      | string  | no       | OneDrive web URL for the folder. Server fills this if absent.               |
| `localPath`      | string  | no       | Absolute path on the scanner's machine. Diagnostic only.                    |
| `onedriveId`     | string  | no       | OneDrive item ID. Server fills this if absent.                              |
| `thumbnail`      | string  | no       | Base64 JPEG (≤64px long edge). Stored once on first import. See note below. |

**First-writer-wins on bundle membership:** the same `contentHash` can appear
in multiple folders (and multiple manifests) with different `bundleKey`s. The
server assigns bundle membership from the *first* manifest entry it sees for
a given hash and ignores later entries' `bundleKey`/`side`. See
[photos.store.ts:234-238](../packages/server/src/db/photos.store.ts#L234).

## Bundle sidecar (`<bundleKey>.json`)

Written by Cowork. One per bundle, named after the local key with the canonical
casing from the source files (`FastFoto_1538.json`, not `fastfoto_1538.json`).
Sidecars live in the same folder as the photos they describe.

```jsonc
{
  "schemaVersion": 1,
  "bundleKey": "fastfoto_1538",
  "processedAt": "2026-05-21T14:32:11.000Z",
  "files": [
    {
      "fileName": "FastFoto_1538_a.jpg",
      "side": "front",
      "photoType": "snapshot",
      "checksum": "a3f8...",
      "checksumAlgorithm": "sha256",
      "thumbnail64": "<base64>",
      "ocr": {
        "has_text": true,
        "confidence": 0.91,
        "text": "Back row: Uncle Ed, ..."
      },
      "faces": [
        { "x": 0.0982, "y": 0.1289, "w": 0.0943, "h": 0.1513 }
      ]
    }
  ]
}
```

| Field           | Type     | Required | Description                                       |
|-----------------|----------|----------|---------------------------------------------------|
| `schemaVersion` | integer  | no¹      | Always `1`.                                       |
| `bundleKey`     | string   | yes      | Local key (lowercase). Must match a known bundle when joined with the folder path. |
| `processedAt`   | ISO 8601 | yes      | When Cowork last processed this bundle.           |
| `files`         | array    | yes      | One entry per physical file in the bundle.        |

¹ Optional today for backward compatibility.

### `files[]` entry

| Field               | Type   | Required | Description                                                              |
|---------------------|--------|----------|--------------------------------------------------------------------------|
| `fileName`          | string | yes      | Exactly matches `PhotoEntry.fileName` from the folder manifest.          |
| `side`              | enum   | yes      | `front` or `back`. Redundant with manifest but keeps sidecar self-contained. |
| `checksum`          | string | yes      | SHA-256 hex. **Sourced from the manifest, never independently recomputed.** Matches `PhotoEntry.contentHash`. |
| `checksumAlgorithm` | string | yes      | `"sha256"`. Reserved for future algorithm changes.                       |
| `photoType`         | enum   | no       | See [Photo types](#photo-types).                                          |
| `thumbnail64`       | string | no       | 64×64 PNG, white-padded, base64. Used as a fallback if the DB thumbnail is absent. |
| `ocr`               | object | no       | See [OCR](#ocr).                                                          |
| `faces`             | array  | no       | See [Faces](#faces).                                                      |

### Photo types

| Value                | Description                                                       |
|----------------------|-------------------------------------------------------------------|
| `cdv`                | Carte de visite — small albumen print on card (~2.5×4 in)         |
| `cabinet_card`       | Cabinet card — larger albumen/gelatin print on card (~4×6.5 in)   |
| `rppc`               | Real photo postcard — silver gelatin print on postcard stock      |
| `tintype`            | Tintype (ferrotype) — image on thin iron sheet                    |
| `snapshot`           | 20th-century amateur snapshot (Kodak era onward)                  |
| `hand_colored`       | Any format that has been hand-colored                             |
| `newspaper_clipping` | Clipping from a newspaper or magazine                             |
| `portrait_print`     | Studio portrait print (larger format, not cabinet card)           |
| `unknown`            | Format could not be determined                                    |

### OCR

```json
{ "has_text": true, "confidence": 0.91, "text": "Back row: Uncle Ed, ..." }
```

| Field        | Type    | Required | Description                                          |
|--------------|---------|----------|------------------------------------------------------|
| `has_text`   | boolean | yes      | `false` means OCR ran and found nothing.             |
| `confidence` | number  | yes      | 0.0–1.0. Producer's confidence in the recognition.   |
| `text`       | string  | yes      | Recognized text. Empty string when `has_text=false`. |

### Faces

Array of face bounding boxes in normalized coordinates (0.0–1.0, origin
top-left, EXIF rotation already applied):

```json
[{ "x": 0.0982, "y": 0.1289, "w": 0.0943, "h": 0.1513 }]
```

| Field | Type   | Required | Description                              |
|-------|--------|----------|------------------------------------------|
| `x`   | number | yes      | Left edge as fraction of image width.    |
| `y`   | number | yes      | Top edge as fraction of image height.    |
| `w`   | number | yes      | Box width as fraction of image width.    |
| `h`   | number | yes      | Box height as fraction of image height.  |

Empty array means face detection ran and found nothing. Omit the field
entirely if face detection was not run.

Detected via OpenCV YuNet (`face_detection_yunet_2023mar.onnx`, confidence
threshold 0.6, 20% padding). Model file:
`packages/server/scripts/models/face_detection_yunet_2023mar.onnx`.
The server ignores it.

## How the server ingests sidecars

The server exposes (or will expose) an **import-sidecars** flow that:

1. Walks the same OneDrive folder tree used by `ManifestSyncService`, applying
   the same skip rules.
2. For each `*.json` file that is **not** `kosh-manifest.json`, parses it as
   a bundle sidecar.
3. Looks up the bundle by reconstructed `scanner_key` (see
   [Linking keys](#linking-keys)). If not found, skip — manifest not synced yet.
4. For each `files[]` entry:

   **OCR** → upsert into `ocr_results` (one row per bundle):
   ```sql
   INSERT INTO ocr_results (id, bundle_id, text, ran_at)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(bundle_id) DO UPDATE SET text = excluded.text, ran_at = excluded.ran_at
   ```
   Concatenate text from all files where `ocr.has_text = true`, joined by
   `\n\n`. (Earlier draft suggested back-wins; concatenation is safer — no
   data lost.)

   **Faces** → on **first import** (no `photo_subjects` rows exist yet for this
   bundle), insert one row per box in `faces[]`:
   - `bundle_id`: resolved bundle UUID
   - `person_id`: NULL (Cowork detects faces but does not identify people)
   - `source`: `"cowork-yunet"`
   - `confidence`: 1.0 (YuNet's per-detection score is not stored in the sidecar)
   - `face_region`: JSON string of the normalized box `{"x":…,"y":…,"w":…,"h":…}`
   - `verified`: 0

   On **re-import** (rows already exist for this bundle): do nothing.  Once a
   face box is in the DB it may have a person assigned to it; silently
   overwriting or reordering rows would corrupt those associations.  If face
   detection needs to be re-run for a bundle, an operator must explicitly clear
   the existing unverified rows first through the admin UI (future feature).

   Rationale: the sidecar is the *input* to the DB, not a mirror of it.  The
   order of boxes in `faces[]` is not meaningful; the DB row's primary key is.

   **photoType** → requires a new column (see [Open work](#open-work) below).

   **thumbnail64** → if the corresponding `photos.thumbnail` BLOB is NULL,
   decode and store. Never overwrite a non-null thumbnail.

5. Idempotent: running twice on the same folder produces the same DB state.

## Stability guarantees

Cowork commits to:

- **Never removing** fields listed in this schema from sidecar files.
- **Always including** `bundleKey`, `processedAt`, and `files[]` with at
  minimum `fileName`, `side`, `checksum`, `checksumAlgorithm`, and `faces`.
- **Backward-compatible additions only**: new fields may appear; existing
  fields will not change type or be renamed without a major-version bump.
- **Idempotent re-runs**: re-processing a bundle overwrites its sidecar in
  place; `processedAt` updates, all data fields are recomputed.

The server commits to:

- **Never writing** sidecar `*.json` files.
- **Idempotent sidecar import**.
- **Preserving** the local-key ↔ scanner_key convention.

## Open work

- **`schemaVersion`** is not yet emitted by either producer. Once both
  produce it, the importer can branch on version. Until then it's optional.
- **`photo_type` column on `bundles`** does not yet exist. Migration:
  ```sql
  ALTER TABLE bundles ADD COLUMN photo_type TEXT
    CHECK(photo_type IN ('cdv','cabinet_card','rppc','tintype','snapshot',
                         'hand_colored','newspaper_clipping','portrait_print','unknown'));
  ```
  After migration, set `photo_type` from the front-side file's `photoType`
  (or any entry if no front side exists).
- **`pages` folder skip** is honored by Cowork but not by the local scanner.
  Adding it to `SKIP_FOLDER_NAMES` in `scan-local.ts` would close the gap.
- **Per-file vs per-bundle OCR storage.** The schema lets each file carry
  OCR; the DB stores it per bundle. If keeping the front's and back's text
  separate becomes useful, move OCR storage to `photos`.
- **Sidecar importer itself** is not yet written.

## Current state (2026-05-25)

- **album16 - Urban** (root folder): 138 sidecars written, covering 186 image
  files. All include `bundleKey`, `processedAt`, `files[]` with `fileName`,
  `side`, `photoType`, `checksum`, `checksumAlgorithm`, `thumbnail64`, `ocr`,
  `faces`. 513 total faces detected.
- **Subfolders of album16** (excluding `archive`/`archived`/`pages`): not yet
  processed.
- **Other albums**: no sidecars yet.
