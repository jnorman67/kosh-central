# Kosh Central

A photo viewer for OneDrive folders with invitation-only authentication. Users browse shared photo albums in a letterbox-style viewer.

## Architecture

Monorepo with npm workspaces:

- **`packages/server`** — Express + TypeScript API server
- **`packages/client`** — Vite + React 19 SPA

## Tech Stack

- **Frontend:** React 19, React Router v6, TanStack React Query, Tailwind CSS, shadcn/ui components
- **Backend:** Express, TypeScript (ESM), MSAL for OneDrive access
- **Database:** SQLite via better-sqlite3 (`packages/server/kosh.db` in dev, `/app/data/kosh.db` in production, replicated to Azure Blob Storage by Litestream)
- **Auth:** JWT in httpOnly cookies, bcrypt password hashing
- **Deployment:** Azure Container Apps (Node 22 in Docker). See [README.md](README.md#deploying-to-azure) for details.

## Commands

```bash
npm run dev        # Start both client (5273) and server (3001) with hot reload
npm run build      # Build both packages for production
npm run lint       # ESLint + Prettier (client only)
npm run kill       # Kill any processes on ports 3001/5273
```

## Project Structure

```
packages/server/src/
  index.ts                          # Express entry point
  db/database.ts                    # SQLite init + migration runner
  db/photos.store.ts                # Photo + location CRUD, manifest import
  db/bundles.store.ts               # Bundle (physical photo) CRUD + preferred-version invariant
  db/relations.store.ts             # Cross-bundle relations (duplicate-of only; front/back/original live on bundles)
  db/series.store.ts                # Photo series + member CRUD
  db/folders.store.ts               # Folder config CRUD + cache + import/export helpers
  db/folders.seed.ts                # One-time seed data for a fresh `folders` table
  auth/msal.service.ts              # OneDrive token acquisition (device code flow)
  auth/auth.middleware.ts            # JWT verification middleware
  auth/users.store.ts                # User CRUD (SQLite)
  config/invites.config.ts           # Hardcoded invite list (email + role)
  routes/auth.router.ts              # /api/auth (register, login, logout, me)
  routes/folders.router.ts           # /api/folders (protected)
  routes/folders-admin.router.ts     # /api/admin/folders (admin-only CRUD + export/import)
  routes/photos.router.ts            # /api/photos (catalog + import)
  routes/photos-admin.router.ts      # /api/admin/photos (admin-only preferred-version toggle)
  routes/relations.router.ts         # /api/relations (duplicate-of only)
  routes/series.router.ts            # /api/series (CRUD + members)
  services/onedrive.service.ts       # Microsoft Graph API client
packages/server/scripts/
  scan-local.ts                      # SHA-256 scanner → JSON manifest

packages/client/src/
  app.tsx                            # Root: QueryClient + AuthQuery + Router
  router/index.tsx                   # Routes: /login, /register, / (protected)
  app/features/auth/                 # Auth pages, service, queries, guards
  app/features/photos/               # Viewer page, folder selector, controls
  app/features/admin/                # Admin pages (folder configuration)
  components/ui/                     # shadcn components (button, card, input, label, select, dialog, alert-dialog, table)
  components/layout/viewer-layout.tsx # CSS Grid shell (header/viewer/toolbar/panel)
```

## Environment Variables

Server env lives in `packages/server/.env` (gitignored):

- `AZURE_CLIENT_ID` — Azure AD app registration client ID
- `JWT_SECRET` — Secret for signing auth tokens

## Database

SQLite with sequential migrations defined in `packages/server/src/db/database.ts`. Add new migrations to the `migrations` array — they run automatically on server startup. The database file is gitignored.

Tables: `users`, `photos` (content-addressed by SHA-256 hash, carry `bundle_id` / `side` / `is_preferred`), `photo_locations` (multiple locations per photo), `bundles` (one per physical photograph; scanner-keyed for idempotent re-import), `photo_relations` (cross-bundle `duplicate-of` only; front/back/original grouping lives on bundles), `photo_series` + `photo_series_members` (ordered groups), `folders` (admin-editable folder config, seeded once from `folders.seed.ts`).

## Auth Flow

Users are invitation-only. Invited emails are hardcoded in `packages/server/src/config/invites.config.ts`. Users register with an invited email, then log in to receive a 7-day JWT cookie. All `/api/folders` routes require authentication.

## State Management

Use React's built-in state (`useState`, `useReducer`) for UI state and React Query for server state. Do not use Zustand or other external state libraries.

## Conventions

- Feature code lives under `app/features/<name>/` with `pages/`, `services/`, `queries/`, `components/`, `models/`, `contexts/`, and `hooks/` subdirectories
- Services are plain classes, injected via React Context
- Query hooks are created via factory functions (e.g., `createPhotosQueries`)
- Prettier + ESLint enforced on client code
