import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFoldersRouter } from './routes/folders.router.js';
import { OneDriveService } from './services/onedrive.service.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

const oneDriveService = new OneDriveService();

app.use(express.json());
app.use('/api/folders', createFoldersRouter(oneDriveService));

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
});
