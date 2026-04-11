# kosh central

Photo viewer for publicly-shared Microsoft 365 Personal OneDrive folders. Displays photos one-by-one in letterbox style, with a layout designed to support future annotation and collaboration features.

## Architecture

- **Frontend** (`packages/client`): Vite + React 19, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack React Query
- **Backend** (`packages/server`): Express on Node.js, resolves OneDrive sharing URLs via Microsoft Graph API
- **Infrastructure**: Azure App Service (Linux, Node 22) via Bicep

## Getting Started

```bash
npm install
npm run dev
```

This starts both the Express server (port 3001) and Vite dev server (port 5173) concurrently. The Vite dev server proxies `/api` requests to the Express server.

## Adding Photo Folders

Edit `packages/server/src/config/folders.config.ts` and add your OneDrive sharing URLs:

```typescript
export const FOLDERS: FolderConfig[] = [
    {
        displayName: 'Vacation 2024',
        sharingUrl: 'https://1drv.ms/f/s!...',
    },
];
```

The sharing URLs must be "Anyone with the link" public shares from OneDrive.

## Building for Production

```bash
npm run build
NODE_ENV=production node packages/server/dist/index.js
```

The Express server serves the built client as static files and handles API requests.

## Project Structure

```
packages/
  client/         Vite + React frontend
    src/
      app/        Feature modules
      components/ Shared UI components (shadcn/ui)
      lib/        Utility functions
      router/     React Router config
  server/         Express backend
    src/
      config/     Hardcoded folder URLs
      routes/     API route handlers
      services/   OneDrive/Graph API integration
infra/            Azure Bicep templates
```
