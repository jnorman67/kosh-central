# Kosh Central

A photo viewer for OneDrive folders with invitation-only authentication. Users browse shared photo albums in a letterbox-style viewer.

## Architecture

Monorepo with npm workspaces:

- **`packages/server`** — Express + TypeScript API server
- **`packages/client`** — Vite + React 19 SPA

## Tech Stack

- **Frontend:** React 19, React Router v6, TanStack React Query, Tailwind CSS, shadcn/ui components
- **Backend:** Express, TypeScript (ESM), MSAL for OneDrive access
- **Database:** SQLite via better-sqlite3 (`packages/server/kosh.db` in dev, `/home/kosh.db` in production)
- **Auth:** JWT in httpOnly cookies, bcrypt password hashing
- **Deployment:** Azure App Service (Linux, Node 22), Bicep templates in `infra/`

## Commands

```bash
npm run dev        # Start both client (5173) and server (3001) with hot reload
npm run build      # Build both packages for production
npm run lint       # ESLint + Prettier (client only)
npm run kill       # Kill any processes on ports 3001/5173
```

## Project Structure

```
packages/server/src/
  index.ts                          # Express entry point
  db/database.ts                    # SQLite init + migration runner
  auth/msal.service.ts              # OneDrive token acquisition (device code flow)
  auth/auth.middleware.ts            # JWT verification middleware
  auth/users.store.ts                # User CRUD (SQLite)
  config/folders.config.ts           # Hardcoded OneDrive folder URLs
  config/invites.config.ts           # Hardcoded invite list (email + role)
  routes/auth.router.ts              # /api/auth (register, login, logout, me)
  routes/folders.router.ts           # /api/folders (protected)
  services/onedrive.service.ts       # Microsoft Graph API client

packages/client/src/
  app.tsx                            # Root: QueryClient + AuthQuery + Router
  router/index.tsx                   # Routes: /login, /register, / (protected)
  app/features/auth/                 # Auth pages, service, queries, guard
  app/features/photos/               # Viewer page, folder selector, controls
  components/ui/                     # shadcn components (button, card, input, label, select)
  components/layout/viewer-layout.tsx # CSS Grid shell (header/viewer/toolbar/panel)
```

## Environment Variables

Server env lives in `packages/server/.env` (gitignored):

- `AZURE_CLIENT_ID` — Azure AD app registration client ID
- `JWT_SECRET` — Secret for signing auth tokens

## Database

SQLite with sequential migrations defined in `packages/server/src/db/database.ts`. Add new migrations to the `migrations` array — they run automatically on server startup. The database file is gitignored.

## Auth Flow

Users are invitation-only. Invited emails are hardcoded in `packages/server/src/config/invites.config.ts`. Users register with an invited email, then log in to receive a 7-day JWT cookie. All `/api/folders` routes require authentication.

## State Management

Use React's built-in state (`useState`, `useReducer`) for UI state and React Query for server state. Do not use Zustand or other external state libraries.

## Conventions

- Feature code lives under `app/features/<name>/` with `pages/`, `services/`, `queries/`, `components/`, `models/`, `contexts/`, and `hooks/` subdirectories
- Services are plain classes, injected via React Context
- Query hooks are created via factory functions (e.g., `createPhotosQueries`)
- Prettier + ESLint enforced on client code
