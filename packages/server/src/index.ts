import cookieParser from 'cookie-parser';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './auth/auth.middleware.js';
import { MsalService } from './auth/msal.service.js';
import { createAuthRouter } from './routes/auth.router.js';
import { createFoldersRouter } from './routes/folders.router.js';
import { OneDriveService } from './services/onedrive.service.js';

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

app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', createAuthRouter());
app.use('/api/folders', requireAuth, createFoldersRouter(oneDriveService));

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
