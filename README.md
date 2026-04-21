# kosh central

Photo viewer for Microsoft 365 Personal OneDrive folders. Displays photos one-by-one in letterbox style, with a layout designed to support future annotation and collaboration features.

## Architecture

- **Frontend** (`packages/client`): Vite + React 19, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack React Query
- **Backend** (`packages/server`): Express on Node.js, resolves OneDrive sharing URLs via Microsoft Graph API with MSAL authentication
- **Infrastructure**: Azure Container Apps (Node 22), with the SQLite database replicated to Azure Blob Storage by Litestream

## Prerequisites

- Node.js 22+
- An Azure AD app registration (see [Authentication Setup](#authentication-setup))

## Getting Started

```bash
npm install
npm run dev
```

This starts both the Express server (port 3001) and Vite dev server (port 5273) concurrently. The Vite dev server proxies `/api` requests to the Express server.

On first run, the server console will print a device code and URL. Open the URL in a browser, sign in with the Microsoft account that owns the OneDrive photos, and enter the code. Subsequent starts reuse cached credentials automatically.

## Authentication Setup

The app uses MSAL (Microsoft Authentication Library) with device code flow to access OneDrive via the Microsoft Graph API.

1. Go to [Azure Portal](https://portal.azure.com) > **App registrations** > **New registration**
2. Name: `kosh-central`
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
4. Redirect URI: leave blank
5. After creation:
   - Go to **Authentication** > set **Allow public client flows** to **Yes**
   - Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated** > **Files.Read.All**
6. Copy the **Application (client) ID** into `packages/server/.env`:
   ```
   AZURE_CLIENT_ID=your-client-id-here
   ```

## MSAL Token Cache

The server stores authentication credentials in `packages/server/.msal-cache.json`. This file is gitignored and contains an access token and a refresh token issued by Microsoft.

**How it works:**

- The **access token** expires after ~1 hour. The server uses it for Graph API calls.
- The **refresh token** lasts ~90 days and is automatically extended each time it's used. As long as the app makes at least one Graph API request within 90 days, the refresh token stays valid indefinitely.
- On startup, the server loads the cache from disk. If a valid refresh token is present, it silently acquires a new access token — no user interaction needed.
- If the cache is missing, empty, or the refresh token has expired, the server triggers device code flow on the next API request: it prints a URL and code to the console, and you authenticate in a browser.

**Local development:** The cache file is created automatically on first authentication and persists across server restarts. You should rarely need to re-authenticate.

**Azure deployment:** The cache lives at `/data/.msal-cache.json` on the Container App's Azure File share, and the deployed server reads/writes it directly. To prime the cache or refresh credentials:

1. Authenticate locally first (`npm run dev`, then trigger an API request to populate `packages/server/.msal-cache.json`)
2. Upload that file to the `kosh-data` share in the `koshcentralstor` storage account (Azure Portal → Storage → File shares, or `az storage file upload`)
3. Restart or scale the Container App; on next start it picks up the cached refresh token

**When you need to re-authenticate:**

- If the app hasn't made a Graph API request in 90+ days, the refresh token expires
- If you revoke the app's permissions in your Microsoft account settings
- If you delete or lose the cached `.msal-cache.json`

In any of these cases, re-authenticate locally and re-upload as above.

## Adding Photo Folders

Folder configuration is stored in the `folders` table and managed through the admin screen at `/admin/folders` (visible to admin users only). On first boot of a fresh database the table is seeded from `packages/server/src/db/folders.seed.ts`; after that, all changes happen in the UI.

From the admin screen you can:

- **Add / edit / delete** folder entries. The OneDrive sharing URL is validated against Microsoft Graph before save, so bad URLs are caught at edit time.
- **Export** the current configuration as JSON.
- **Import** a JSON file to propagate changes between environments (dev ↔ prod). Two modes: _upsert_ (add/update by slug, leave others untouched) or _replace_ (wipe existing rows, then insert the file's contents).

To get a sharing URL: right-click a folder in OneDrive > **Share** > **Anyone with the link** > **Copy link**.

`folderPath` is the directory path relative to the local scan root, using forward slashes. It must match the `folderName` recorded by `scan-local.ts` so that local catalog data (content hash, bundle membership, etc.) can be joined to the OneDrive listing at request time. The `slug` is used in bookmarkable URLs and must be stable once published.

## Local Catalog & Matching Strategy

`scripts/scan-local.ts` walks a root directory once, computes SHA-256 for every image, groups files that share a base name (e.g. `photo.jpg`, `photo_a.jpg`, `photo_b.jpg`) into **bundles** representing one physical photograph, assigns each file a `side` (front/back) and a heuristic preferred hint, and emits a manifest. The manifest is imported via `POST /api/photos/import` and stored in SQLite. At request time, files returned by OneDrive are joined to local catalog rows by `(folderPath, fileName)`.

**Bundles and preferred versions.** A bundle has zero or more front versions (e.g. `photo.jpg` + `photo_a.jpg`) and zero or more backs (e.g. `photo_b.jpg`). Exactly one photo per `(bundle, side)` is marked `is_preferred`, enforced by a partial unique index. The scanner picks a default (enhanced variants beat bare names); admins can override with `PUT /api/admin/photos/:photoId/preferred`. Re-scans look up bundles by `scanner_key`, so admin overrides survive re-imports.

**Current limitation — name-based matching is brittle.** OneDrive's folder listing returns file names, not content hashes, so we have no choice but to join on `(folderPath, fileName)`. This breaks down when:

- A file is renamed in OneDrive but not locally (or vice versa) — the join silently misses and the OneDrive entry shows up without its hash, bundle, or other local metadata.
- Two files in the same folder share a name across cases on a case-sensitive scan but a case-insensitive OneDrive (or the reverse) — false matches or missed matches.
- A folder is restructured (renamed, moved, or split) — every `folderPath` in `FolderConfig` becomes stale at once.
- The same physical file is referenced from multiple folders — local catalog supports multiple locations per content hash, but name-based matching can't take advantage of that.

**Future direction.** Once Graph API queries can cheaply return file hashes (Graph exposes `file.hashes.quickXorHash` and sometimes `sha1Hash`/`sha256Hash` for OneDrive Personal), we should match on content hash instead of name. That makes the join rename-proof and lets a single local record back multiple OneDrive locations. Until then, treat `folderPath` as a deployment-time contract: keep it in sync with both the scan root and the OneDrive folder structure.

**Running the scanner on Windows.** Open a **cmd** terminal (not PowerShell — PowerShell's execution policy blocks the `npx.ps1` shim):

```
cd c:\vc\kosh-central
npx tsx .\packages\server\scripts\scan-local.ts "C:\Users\jnorm\OneDrive\Photo Vault" -o .\packages\server\manifest.json
```

## Running in Production (locally)

```bash
npm run build
npm run start -w @kosh-central/server
```

Then visit http://localhost:3001. The Express server serves the built client as static files and handles API requests.

## Deploying to Azure

The app is hosted at https://photos.kosh-central.com on **Azure Container Apps**, with the SQLite database replicated to Azure Blob Storage by **Litestream**.

### Domain

`kosh-central.com` is registered through Cloudflare Registrar (purchased 2026-04-18, auto-renews ~$11/yr). DNS is hosted at Cloudflare. The `photos` subdomain is bound to the Container App with a free Azure-managed certificate (auto-renews).

The apex (`kosh-central.com`) and `www.kosh-central.com` 301-redirect to `https://photos.kosh-central.com`, preserving path and query string. This is implemented as a Cloudflare Redirect Rule; the apex and `www` have proxied AAAA records pointing at `100::` so Cloudflare terminates TLS and serves the redirect without an origin. SSL/TLS mode is **Full (strict)**.

### Deploying

```bash
npm run deploy:container
```

This runs:
1. `npm run deploy:image` — builds the Docker image locally and pushes to ACR (`koshcentralacr.azurecr.io/kosh-central:latest`).
2. `npm run deploy:restart` — `az containerapp update` with a timestamped `--revision-suffix` so a fresh revision is created and the new image is pulled.

Typical deploy: ~60–90 seconds.

### Data layout

The Container App has two storage backends:

- **Local container disk at `/app/data/kosh.db`** — SQLite database (users, photos, relations, series). Replicated to Azure Blob Storage (`abs://kosh-litestream/kosh.db`) by Litestream. On container start, [docker-entrypoint.sh](docker-entrypoint.sh) restores the DB from blob if a replica exists, then `exec`s `litestream replicate -exec node …` so the Node app runs as a child of Litestream and replication streams live.
- **Azure File share mounted at `/data`** — non-SQLite state:
  - `/data/.msal-cache.json` — OneDrive OAuth token cache
  - `/data/manifest.json` — photo scan manifest consumed on startup

The Docker image sets `KOSH_DATA_DIR=/data` and `KOSH_DB_PATH=/app/data/kosh.db`. In dev (neither set), paths fall back to `packages/server/...`.

**Why split storage?** SQLite cannot run on Azure Files (SMB): SQLite's POSIX advisory locks don't work reliably over SMB, so write transactions hang or fail with `SQLITE_BUSY`. Litestream gives us durability for the DB by replicating from local disk to blob storage. Plain JSON files (manifest, MSAL cache) are fine on the SMB share.

## Project Structure

```
packages/
  client/           Vite + React frontend
    src/
      app/          Feature modules (photos viewer)
      components/   Shared UI components (shadcn/ui)
      lib/          Utility functions
      router/       React Router config
  server/           Express backend
    src/
      auth/         MSAL authentication (device code flow)
      config/       Hardcoded folder URLs
      routes/       API route handlers
      services/     OneDrive/Graph API integration
```
