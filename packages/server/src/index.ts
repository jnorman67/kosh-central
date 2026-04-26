import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './auth/auth.middleware.js';
import { MsalService } from './auth/msal.service.js';
import { initDb } from './db/database.js';
import { listFolders, seedFoldersIfEmpty } from './db/folders.store.js';
import { getDb } from './db/database.js';
import { importManifest, type PhotoManifestEntry } from './db/photos.store.js';
import { createAuthRouter } from './routes/auth.router.js';
import { createFavoritesRouter } from './routes/favorites.router.js';
import { createFoldersAdminRouter } from './routes/folders-admin.router.js';
import { createFoldersRouter } from './routes/folders.router.js';
import { createPhotosAdminRouter } from './routes/photos-admin.router.js';
import { createPhotosRouter } from './routes/photos.router.js';
import { createRatingsRouter } from './routes/ratings.router.js';
import { createPersonsAdminRouter } from './routes/persons-admin.router.js';
import { createPersonsRouter } from './routes/persons.router.js';
import { createRelationsRouter } from './routes/relations.router.js';
import { createCommentsRouter } from './routes/comments.router.js';
import { createSeriesRouter } from './routes/series.router.js';
import { OneDriveService } from './services/onedrive.service.js';
import { ThumbnailCacheService } from './services/thumbnail-cache.service.js';

/** Synchronous stdout write, bypasses Node's block-buffered stdout. Use for boot markers
 *  so diagnostic lines reach the log stream even when the process is SIGKILLed. */
function boot(msg: string): void {
    fs.writeSync(1, `[boot ${new Date().toISOString()}] ${msg}\n`);
}

process.on('uncaughtException', (err) => {
    fs.writeSync(2, `[uncaughtException] ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exit(1);
});
process.on('unhandledRejection', (err) => {
    fs.writeSync(2, `[unhandledRejection] ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exit(1);
});

boot('process start');
boot('initDb...');
initDb();
boot('seedFolders...');
seedFoldersIfEmpty();
boot('loadManifest...');
loadManifest();
boot('loadManifest done');

function loadManifest(): void {
    // Import is idempotent but expensive (tens of thousands of rows in one txn)
    // and races with Litestream at startup. Once the DB is populated, skip it.
    // Set KOSH_FORCE_MANIFEST_IMPORT=1 to force re-import after scanner changes.
    if (process.env.KOSH_FORCE_MANIFEST_IMPORT !== '1') {
        const { count } = getDb().prepare('SELECT COUNT(*) AS count FROM photos').get() as { count: number };
        if (count > 0) {
            console.log(`Manifest import skipped: ${count} photos already in DB (set KOSH_FORCE_MANIFEST_IMPORT=1 to force)`);
            return;
        }
    }

    const manifestPath = process.env.KOSH_DATA_DIR
        ? path.join(process.env.KOSH_DATA_DIR, 'manifest.json')
        : path.resolve(import.meta.dirname, '../data/manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.log(`Manifest not found at ${manifestPath} — skipping import`);
        return;
    }

    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
        photos?: PhotoManifestEntry[];
    };

    const photoCount = raw.photos?.length ?? 0;
    console.log(`Manifest: ${photoCount} photos in ${manifestPath}`);

    if (!photoCount) return;

    const result = importManifest(raw.photos!, listFolders().map((f) => f.folderPath));
    console.log(
        `Manifest import: ${result.created} new photos, ${result.existing} already known, ` +
            `${result.bundles} bundles referenced, ${result.seriesMembers} folder-series memberships`,
    );
}

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
if (!AZURE_CLIENT_ID) {
    console.error('AZURE_CLIENT_ID environment variable is required.');
    console.error('Register an app at https://entra.microsoft.com > App registrations');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT ?? 3001;

boot('msal construct...');
const msalService = new MsalService(AZURE_CLIENT_ID);
boot('msal loadCache...');
await msalService.loadCache();
boot('msal loadCache done');
if (!msalService.isAuthenticated()) {
    console.log('No cached credentials — starting device code flow...');
    await msalService.authenticate();
}
const oneDriveService = new OneDriveService(msalService);

// Regenerable cache of proxied cover thumbnail bytes. Defaults vary by environment because
// Container Apps' /home is SMB-backed (slow for cache traffic) while App Service's /home is
// the expected persistent mount. Operators can override with KOSH_COVER_CACHE_DIR.
const coverCacheDir =
    process.env.KOSH_COVER_CACHE_DIR ??
    (process.env.NODE_ENV === 'production'
        ? path.join(os.tmpdir(), 'kosh-cover-cache')
        : path.resolve(import.meta.dirname, '../cover-cache'));
boot(`thumbnailCache construct (${coverCacheDir})...`);
const thumbnailCache = new ThumbnailCacheService(coverCacheDir);
console.log(`Cover thumbnail cache: ${coverCacheDir}`);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.get('/api/version', (_req, res) => {
    res.json({ sha: process.env.GIT_SHA ?? 'dev' });
});
app.use('/api/auth', createAuthRouter());
app.use('/api/admin/folders', requireAuth, createFoldersAdminRouter(oneDriveService));
app.use('/api/admin/photos', requireAuth, createPhotosAdminRouter());
app.use('/api/favorites', requireAuth, createFavoritesRouter(oneDriveService));
app.use('/api/folders', requireAuth, createFoldersRouter(oneDriveService, thumbnailCache));
app.use('/api/photos', requireAuth, createPhotosRouter());
app.use('/api/ratings', requireAuth, createRatingsRouter());
app.use('/api/admin/persons', requireAuth, createPersonsAdminRouter());
app.use('/api/persons', requireAuth, createPersonsRouter());
app.use('/api/relations', requireAuth, createRelationsRouter());
app.use('/api/series', requireAuth, createSeriesRouter());
app.use('/api/comments', requireAuth, createCommentsRouter());

// Global error handler — catches synchronous throws from route handlers and
// errors forwarded via next(err). Must have 4 parameters for Express to treat it as an error handler.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled route error:', err);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Static file serving in production
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const clientDist = path.join(__dirname, '../../client/dist');

if (process.env.NODE_ENV === 'production') {
    app.use(
        express.static(clientDist, {
            setHeaders: (res, filePath) => {
                if (filePath.endsWith('index.html')) {
                    res.setHeader('Cache-Control', 'no-cache');
                } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                }
            },
        }),
    );
    app.get('*', (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

boot(`app.listen on ${PORT}...`);
const httpServer = app.listen(PORT, () => {
    boot('listening');
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown: close the HTTP listener so the event loop can exit.
// Without this, `tsx watch` has to force-kill on Ctrl+C and reload.
function shutdown(signal: NodeJS.Signals): void {
    console.log(`\nReceived ${signal}, shutting down...`);
    httpServer.close(() => process.exit(0));
    // Fallback: if open connections prevent close() from completing, exit anyway.
    setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
