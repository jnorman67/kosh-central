import fs from 'node:fs';
import path from 'node:path';

/**
 * On-disk cache for proxied OneDrive thumbnail bytes, keyed by an opaque token
 * (typically the OneDrive item id of the cover photo). Files are small JPEGs;
 * the cache is regenerable, so restart loss is fine.
 */
export class ThumbnailCacheService {
    constructor(private readonly dir: string) {
        fs.mkdirSync(dir, { recursive: true });
    }

    private fileFor(key: string): string {
        // OneDrive item ids are alphanumeric with a few separators; strip anything
        // outside that set to defend against path traversal via crafted inputs.
        const safe = key.replace(/[^A-Za-z0-9._-]/g, '_');
        return path.join(this.dir, safe);
    }

    read(key: string): Buffer | null {
        try {
            return fs.readFileSync(this.fileFor(key));
        } catch {
            return null;
        }
    }

    write(key: string, data: Buffer): void {
        const dest = this.fileFor(key);
        const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tmp, data);
        fs.renameSync(tmp, dest);
    }
}
