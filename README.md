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

Credentials are cached to `.msal-cache.json` (gitignored). The refresh token lasts ~90 days and is extended on each use.

## Adding Photo Folders

Edit `packages/server/src/config/folders.config.ts` and add your OneDrive sharing URLs:

```typescript
export const FOLDERS: FolderConfig[] = [
  {
    displayName: "My Album",
    sharingUrl: "https://1drv.ms/f/c/...",
  },
];
```

To get a sharing URL: right-click a folder in OneDrive > **Share** > **Anyone with the link** > **Copy link**.

## Running in Production (locally)

```bash
npm run build
npm run start -w @kosh-central/server
```

Then visit http://localhost:3001. The Express server serves the built client as static files and handles API requests.

## Deploying to Azure

```bash
npm run build
zip -r deploy.zip packages/server/dist packages/server/.msal-cache.json packages/client/dist node_modules package.json packages/server/package.json packages/client/package.json
az webapp deploy --resource-group kosh-central-rg --name kosh-central --src-path deploy.zip --type zip
```

The app is hosted at https://kosh-central.azurewebsites.net

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
