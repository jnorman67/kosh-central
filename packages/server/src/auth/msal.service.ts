import { PublicClientApplication, type AccountInfo, type AuthenticationResult, type Configuration } from '@azure/msal-node';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Cache location, preferring an explicit data dir (Container Apps file share) over
// Azure App Service's /home fallback, over the in-repo dev path.
const BUNDLED_CACHE_PATH = path.join(__dirname, '../../.msal-cache.json');
const CACHE_PATH = (() => {
    if (process.env.KOSH_DATA_DIR) return path.join(process.env.KOSH_DATA_DIR, '.msal-cache.json');
    if (process.env.NODE_ENV === 'production') return path.join('/home', '.msal-cache.json');
    return BUNDLED_CACHE_PATH;
})();

function ensureSeededCache(): void {
    if (CACHE_PATH === BUNDLED_CACHE_PATH) return;
    if (fs.existsSync(CACHE_PATH)) return;
    if (!fs.existsSync(BUNDLED_CACHE_PATH)) return;
    try {
        fs.copyFileSync(BUNDLED_CACHE_PATH, CACHE_PATH);
        console.log(`Seeded MSAL cache: ${BUNDLED_CACHE_PATH} → ${CACHE_PATH}`);
    } catch (err) {
        console.error('Failed to seed MSAL cache:', err);
    }
}

// Files.ReadWrite is required by /createLink to mint the anonymous view URLs
// surfaced by the "Open in OneDrive" button. Read-only scopes reject that call.
const SCOPES = ['Files.ReadWrite'];

export class MsalService {
    private pca: PublicClientApplication;
    private account: AccountInfo | null = null;

    constructor(clientId: string) {
        const config: Configuration = {
            auth: {
                clientId,
                authority: 'https://login.microsoftonline.com/consumers',
            },
        };

        this.pca = new PublicClientApplication(config);
    }

    async loadCache(): Promise<void> {
        ensureSeededCache();
        try {
            if (fs.existsSync(CACHE_PATH)) {
                const cacheData = fs.readFileSync(CACHE_PATH, 'utf-8');
                this.pca.getTokenCache().deserialize(cacheData);

                // Restore the account from cache
                const accounts = await this.pca.getTokenCache().getAllAccounts();
                if (accounts.length > 0) {
                    this.account = accounts[0];
                }
            }
        } catch {
            // Cache file missing or corrupt — start fresh
        }
    }

    private saveCache(): void {
        try {
            const cacheData = this.pca.getTokenCache().serialize();
            fs.writeFileSync(CACHE_PATH, cacheData, 'utf-8');
        } catch (err) {
            console.error('Failed to save MSAL cache:', err);
        }
    }

    async getAccessToken(): Promise<string> {
        // Try silent acquisition first (uses cached access/refresh tokens)
        if (this.account) {
            try {
                const result = await this.pca.acquireTokenSilent({
                    account: this.account,
                    scopes: SCOPES,
                });
                this.saveCache();
                return result.accessToken;
            } catch {
                // Silent acquisition failed — fall through to device code
                this.account = null;
            }
        }

        // Device code flow — requires user interaction
        const result = await this.pca.acquireTokenByDeviceCode({
            scopes: SCOPES,
            deviceCodeCallback: (response) => {
                console.log('\n' + '='.repeat(60));
                console.log('AUTHENTICATION REQUIRED');
                console.log(response.message ?? `Go to ${response.verificationUri} and enter code: ${response.userCode}`);
                console.log('='.repeat(60) + '\n');
            },
        });

        if (!result) {
            throw new Error('Device code authentication failed — no result returned');
        }
        this.account = result.account;
        this.saveCache();
        return result.accessToken;
    }

    isAuthenticated(): boolean {
        return this.account !== null;
    }
}
