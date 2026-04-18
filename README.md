# kosh central

Photo viewer for Microsoft 365 Personal OneDrive folders. Displays photos one-by-one in letterbox style, with a layout designed to support future annotation and collaboration features.

## Architecture

- **Frontend** (`packages/client`): Vite + React 19, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack React Query
- **Backend** (`packages/server`): Express on Node.js, resolves OneDrive sharing URLs via Microsoft Graph API with MSAL authentication
- **Infrastructure**: Azure App Service (Linux, Node 22) via Bicep

## Prerequisites

- Node.js 22+
- An Azure AD app registration (see [Authentication Setup](#authentication-setup))

## Getting Started

```bash
npm install
npm run dev
```

This starts both the Express server (port 3001) and Vite dev server (port 5173) concurrently. The Vite dev server proxies `/api` requests to the Express server.

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

**Azure deployment:** The F1 (Free) App Service tier does not support SSH, so you cannot run device code flow on the server directly. Instead:

1. Authenticate locally first (`npm run dev`, then trigger an API request)
2. Include `packages/server/.msal-cache.json` in the deployment zip (the deploy command in this README already does this)
3. The deployed server picks up the cached refresh token and operates normally

**When you need to re-authenticate:**

- If the app hasn't made a Graph API request in 90+ days, the refresh token expires
- If you revoke the app's permissions in your Microsoft account settings
- If you delete or lose the `.msal-cache.json` file

In any of these cases, re-authenticate locally and redeploy:

```bash
# Delete the stale cache
rm packages/server/.msal-cache.json

# Start the dev server and hit http://localhost:5173 to trigger auth
npm run dev

# After authenticating in the browser, redeploy
npm run deploy
```

## Adding Photo Folders

Edit `packages/server/src/config/folders.config.ts` and add your OneDrive sharing URLs:

```typescript
export const FOLDERS: FolderConfig[] = [
  {
    displayName: "My Album",
    sharingUrl: "https://1drv.ms/f/c/...",
    folderPath: "Dorothy's albums/album20",
  },
];
```

To get a sharing URL: right-click a folder in OneDrive > **Share** > **Anyone with the link** > **Copy link**.

`folderPath` is the directory path relative to the local scan root, using forward slashes. It must match the `folderName` recorded by `scan-local.ts` so that local catalog data (content hash, front/back relations, etc.) can be joined to the OneDrive listing at request time.

## Local Catalog & Matching Strategy

`scripts/scan-local.ts` walks a root directory once, computes SHA-256 for every image, detects front/back and original/enhanced relations from filename conventions, and emits a manifest. The manifest is imported via `POST /api/photos/import` and stored in SQLite. At request time, files returned by OneDrive are joined to local catalog rows by `(folderPath, fileName)`.

**Current limitation — name-based matching is brittle.** OneDrive's folder listing returns file names, not content hashes, so we have no choice but to join on `(folderPath, fileName)`. This breaks down when:

- A file is renamed in OneDrive but not locally (or vice versa) — the join silently misses and the OneDrive entry shows up without its hash, relations, or other local metadata.
- Two files in the same folder share a name across cases on a case-sensitive scan but a case-insensitive OneDrive (or the reverse) — false matches or missed matches.
- A folder is restructured (renamed, moved, or split) — every `folderPath` in `FolderConfig` becomes stale at once.
- The same physical file is referenced from multiple folders — local catalog supports multiple locations per content hash, but name-based matching can't take advantage of that.

**Future direction.** Once Graph API queries can cheaply return file hashes (Graph exposes `file.hashes.quickXorHash` and sometimes `sha1Hash`/`sha256Hash` for OneDrive Personal), we should match on content hash instead of name. That makes the join rename-proof and lets a single local record back multiple OneDrive locations. Until then, treat `folderPath` as a deployment-time contract: keep it in sync with both the scan root and the OneDrive folder structure.

## Running in Production (locally)

```bash
npm run build
npm run start -w @kosh-central/server
```

Then visit http://localhost:3001. The Express server serves the built client as static files and handles API requests.

## Deploying to Azure

The app is hosted at https://kosh-central.azurewebsites.net (App Service, legacy) and is migrating to **Azure Container Apps**. During the transition both paths exist.

### Container Apps (new — preferred)

After the one-time migration (see below), every deploy is:

```bash
npm run deploy:container
```

This runs two steps:
1. `npm run deploy:image` — `az acr build` uploads the source and builds the Docker image on Azure's side.
2. `npm run deploy:restart` — `az containerapp update` rolls to the new image.

Typical deploy: ~60-90 seconds. No zip, no extraction, no Kudu.

#### Data layout

The Container App mounts an Azure File share at `/data`. Everything the app writes goes there:

- `/data/kosh.db` — SQLite database (users, photos, relations, series)
- `/data/.msal-cache.json` — OneDrive OAuth token cache
- `/data/manifest.json` — photo scan manifest consumed on startup

The Docker image sets `KOSH_DATA_DIR=/data` so [database.ts](packages/server/src/db/database.ts) and [msal.service.ts](packages/server/src/auth/msal.service.ts) route file I/O to the mount. In dev (no `KOSH_DATA_DIR`), paths fall back to `packages/server/...` as before.

#### First-time migration

One-time provisioning (creates ACR, Storage Account + file share, Container Apps Environment, first image, and the Container App):

```bash
export AZURE_CLIENT_ID=<same value as current App Service setting>
export JWT_SECRET=<same value as current App Service setting>
bash scripts/azure-provision.sh
```

Then copy current production data onto the new file share (pulls `/home/kosh.db` and the MSAL cache from App Service via Kudu, uploads with your local manifest):

```bash
bash scripts/azure-migrate-data.sh
```

Verify the Container App URL works, flip any custom domain, then stop the old App Service (`az webapp stop --resource-group kosh-central-rg --name kosh-central`). Keep it stopped-but-alive for ~1 week as a rollback path before deleting.

### App Service (legacy — rollback only)

```bash
npm run deploy
```

Still works. Uses the zip-upload path; subject to 504 timeouts on large pushes. Once the Container App is verified, delete the App Service and remove these scripts.

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
infra/              Azure Bicep templates
```
