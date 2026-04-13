import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './auth/auth.middleware.js';
import { MsalService } from './auth/msal.service.js';
import { initDb } from './db/database.js';
import { importManifest, type PhotoManifestEntry } from './db/photos.store.js';
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
    if (!fs.existsSync(manifestPath)) return;

    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { photos?: PhotoManifestEntry[] };
    if (!raw.photos?.length) return;

    const result = importManifest(raw.photos);
    if (result.created > 0) {
        console.log(`Manifest import: ${result.created} new photos, ${result.existing} already known`);
    }
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (!msalService.isAuthenticated()) {
        console.log('No cached credentials found. Authentication will be triggered on first API request.');
    }
});
