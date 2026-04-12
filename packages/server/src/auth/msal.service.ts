import { PublicClientApplication, type AccountInfo, type AuthenticationResult, type Configuration } from '@azure/msal-node';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CACHE_PATH = path.join(__dirname, '../../.msal-cache.json');

const SCOPES = ['Files.Read.All'];

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
