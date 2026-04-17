import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './auth/auth.middleware.js';
import { MsalService } from './auth/msal.service.js';
import { initDb } from './db/database.js';
import { importManifest, type ManifestRelationEntry, type PhotoManifestEntry } from './db/photos.store.js';
import { createAuthRouter } from './routes/auth.router.js';
import { createFoldersRouter } from './routes/folders.router.js';
import { createPhotosRouter } from './routes/photos.router.js';
import { createRelationsRouter } from './routes/relations.router.js';
import { createSeriesRouter } from './routes/series.router.js';
import { OneDriveService } from './services/onedrive.service.js';

initDb();
loadManifest();

function loadManifest(): void {
    const manifestPath = path.resolve(import.meta.dirname, '../data/manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.log(`Manifest not found at ${manifestPath} — skipping import`);
        return;
    }

    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
        photos?: PhotoManifestEntry[];
        relations?: ManifestRelationEntry[];
    };

    const photoCount = raw.photos?.length ?? 0;
    const relationCount = raw.relations?.length ?? 0;
    console.log(`Manifest: ${photoCount} photos, ${relationCount} relations in ${manifestPath}`);

    if (!photoCount) return;

    const result = importManifest(raw.photos!, raw.relations);
    console.log(
        `Manifest import: ${result.created} new photos, ${result.existing} already known, ` +
            `${result.relations} new relations (of ${relationCount} in manifest)`,
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

const msalService = new MsalService(AZURE_CLIENT_ID);
await msalService.loadCache();
const oneDriveService = new OneDriveService(msalService);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use('/api/auth', createAuthRouter());
app.use('/api/folders', requireAuth, createFoldersRouter(oneDriveService));
app.use('/api/photos', requireAuth, createPhotosRouter());
app.use('/api/relations', requireAuth, createRelationsRouter());
app.use('/api/series', requireAuth, createSeriesRouter());

// Static file serving in production
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const clientDist = path.join(__dirname, '../../client/dist');

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

const httpServer = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (!msalService.isAuthenticated()) {
        console.log('No cached credentials found. Authentication will be triggered on first API request.');
    }
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
