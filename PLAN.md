# kosh-central: OneDrive Photo Viewer

## Context

Build a web app that displays photos from publicly-shared Microsoft 365 Personal OneDrive folders. The app has a hardcoded list of sharing URLs; the backend resolves them via the Microsoft Graph API and the frontend shows photos one-by-one in letterbox style. The layout is designed from day one to accommodate future annotation and collaboration panels alongside the viewer.

Patterns and tooling are adapted from the reference project at `/home/jim/vc/dotnetmon/src/applications/runningMate/RunningMate.Web.Host`.

---

## Architecture

```
Browser  <-->  Vite Dev Server (port 5173, proxies /api)  <-->  Express (port 3001)  <-->  Graph API
                                                                     |
Browser  <-->  Express (prod, serves static + API)  <-->  Graph API
```

- **Frontend**: Vite + React 19 + TypeScript, Tailwind CSS + shadcn/ui, React Router v6, TanStack React Query
- **Backend**: Express on Node 22, TypeScript compiled with `tsx` in dev
- **Infra**: Azure App Service (Linux, Node 22) via Bicep; single service hosts both API and static files
- **OneDrive**: Graph API `/shares/{encodedUrl}/driveItem/children` — authenticated via MSAL device code flow

---

## Project Structure

```
kosh-central/
├── README.md
├── PLAN.md
├── package.json                       # npm workspaces root
├── .gitignore
├── packages/
│   ├── client/                        # Vite + React
│   │   ├── package.json
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── tsconfig.app.json
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── components.json            # shadcn/ui
│   │   ├── eslint.config.mjs
│   │   ├── .prettierrc
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── app.tsx                # QueryClientProvider + RouterProvider
│   │       ├── assets/
│   │       │   └── index.css          # Tailwind directives + CSS vars
│   │       ├── lib/
│   │       │   └── utils.ts           # cn() helper
│   │       ├── components/
│   │       │   ├── ui/                # shadcn/ui generated
│   │       │   └── layout/
│   │       │       └── viewer-layout.tsx
│   │       ├── router/
│   │       │   └── index.tsx
│   │       └── app/
│   │           └── features/
│   │               └── photos/
│   │                   ├── models/photos.models.ts
│   │                   ├── services/photos.service.ts
│   │                   ├── queries/photos.queries.ts
│   │                   ├── hooks/use-viewer-state.ts
│   │                   ├── components/
│   │                   │   ├── letterbox-viewer.tsx
│   │                   │   ├── folder-selector.tsx
│   │                   │   └── photo-controls.tsx
│   │                   └── pages/
│   │                       └── viewer-page.tsx
│   │
│   └── server/                        # Express backend
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env                       # AZURE_CLIENT_ID (gitignored)
│       ├── .env.example
│       └── src/
│           ├── index.ts               # Express entry + static serving
│           ├── auth/
│           │   └── msal.service.ts    # MSAL device code flow + token cache
│           ├── config/
│           │   └── folders.config.ts  # HARDCODED sharing URLs
│           ├── services/
│           │   └── onedrive.service.ts
│           └── routes/
│               └── folders.router.ts
│
└── infra/
    ├── main.bicep
    └── parameters.json
```

---

## Backend API

Two endpoints:

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/folders` | `{ id: string, displayName: string }[]` — the hardcoded folder list |
| GET | `/api/folders/:id/photos` | `{ id: string, name: string, downloadUrl: string, mimeType: string }[]` — photos in that folder |

### OneDrive resolution

1. Acquire access token via MSAL (silent from cache, or device code flow on first run)
2. Base64url-encode the sharing URL, prepend `u!`
3. `GET https://graph.microsoft.com/v1.0/shares/{encoded}/driveItem/children` with `Authorization: Bearer` header
4. Filter to `file.mimeType.startsWith('image/')`
5. Return `@microsoft.graph.downloadUrl` (direct, time-limited CDN link)
6. Cache results in-memory with 10-minute TTL (download URLs expire in ~1 hour)

### Key file: `packages/server/src/config/folders.config.ts`

```typescript
export interface FolderConfig {
    displayName: string;
    sharingUrl: string;  // e.g. 'https://1drv.ms/f/s!...'
}

export const FOLDERS: FolderConfig[] = [
    // ADD YOUR ONEDRIVE SHARING URLS HERE
];
```

---

## Frontend Design

### Layout (viewer-layout.tsx)

CSS grid with named areas, designed for future panels:

```
[header ]  [header ]  [header      ]
[viewer ]  [viewer ]  [right-panel?]
[toolbar]  [toolbar]  [toolbar     ]
```

- `rightPanel` prop is optional — absent in v1, used later for annotation tools
- The viewer area uses `min-h-0 overflow-hidden` so the image never blows out the grid

### Letterbox viewer (letterbox-viewer.tsx)

Pure CSS letterboxing — no JS calculations:
- Outer container: `w-full h-full bg-black flex items-center justify-center`
- Image: `max-w-full max-h-full object-contain`
- `object-contain` preserves aspect ratio; the black background fills remaining space

### Photo navigation

- `useViewerState` custom hook (React `useState`/`useReducer`) holds `currentFolderIndex` and `currentPhotoIndex`
- Arrow keys (Left/Right) navigate between photos via `useEffect` keyboard listener
- Photo controls component shows prev/next buttons and "3 / 24" counter
- Preload next 2 photos via `<link rel="preload" as="image">` in the page component

### Data flow (following reference project patterns)

```
Component → React Query hook → PhotosService.fetch() → /api/folders/...
```

- `PhotosService` class wraps `fetch()` calls
- Query factory (`createPhotosQueries`) binds service methods to React Query hooks
- `useGetFolders()` — staleTime: Infinity (never changes at runtime)
- `useGetPhotos(folderId)` — staleTime: 10 min (matches server cache)

### Folder selector

shadcn/ui `Select` component in the header, populated from `useGetFolders()`

---

## Styling

Tailwind CSS with CSS variables, matching reference project conventions:
- `.prettierrc`: 4-space indent, single quotes, trailing commas, 140 width, `prettier-plugin-organize-imports`
- Path alias: `@/` → `./src/`
- shadcn/ui initialized with default theme (neutral base, CSS variables)
- Custom `--viewer-bg` variable for the letterbox background color

---

## Azure Infrastructure (infra/main.bicep)

- App Service Plan: Linux, B1 tier
- Web App: Node 22 LTS, startup command `node packages/server/dist/index.js`
- Environment: `NODE_ENV=production`, `PORT=8080`

In production, Express serves `packages/client/dist/` as static files with SPA fallback.

---

## Implementation Order

### Step 1: Project scaffold
- Root `package.json` with npm workspaces
- `.gitignore`
- `packages/server/` — package.json, tsconfig, minimal Express server
- `packages/client/` — Vite + React + TypeScript scaffold
- Tailwind CSS + PostCSS setup
- shadcn/ui init (`components.json`, `lib/utils.ts`, base CSS)
- Vite config with `@/` alias and `/api` proxy to port 3001
- `concurrently` for `npm run dev` at root

### Step 2: Backend
- `folders.config.ts` with placeholder URLs
- `onedrive.service.ts` — URL encoding, Graph API fetch, in-memory cache
- `folders.router.ts` — `/api/folders` and `/api/folders/:id/photos`
- Wire into Express entry point
- Test with curl

### Step 3: Frontend data layer
- `photos.models.ts` — TypeScript interfaces
- `photos.service.ts` — fetch wrapper
- `photos.queries.ts` — React Query factory
- `use-viewer-state.ts` — custom hook with `useReducer` for navigation state
- `app.tsx` — QueryClientProvider + RouterProvider

### Step 4: UI components
- `viewer-layout.tsx` — CSS grid shell
- `letterbox-viewer.tsx` — image display with loading state
- `photo-controls.tsx` — prev/next, counter, keyboard bindings
- `folder-selector.tsx` — shadcn Select in header
- `viewer-page.tsx` — connects state, queries, and components
- Router setup with single `/` route

### Step 5: Polish
- ESLint config
- Prettier config
- README.md with setup instructions, architecture overview, and how to add folders

### Step 6: Azure infrastructure
- `infra/main.bicep` + `parameters.json`
- Production static file serving in Express

---

## Verification

1. `npm run dev` — both client and server start, no errors
2. Visit `http://localhost:5173` — app loads, folder selector appears
3. Add a real OneDrive sharing URL to `folders.config.ts` — photos load and display
4. Arrow keys navigate between photos; letterbox effect works at various window sizes
5. `npm run build` — both packages compile without errors
6. `NODE_ENV=production node packages/server/dist/index.js` — serves the built client correctly
