/** Statuses Graph and SharePoint use to ask callers to back off: throttled, or temporarily unavailable. */
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_ATTEMPTS = 5;
/** Backoff when the response doesn't say how long to wait: 2s, 4s, 8s, 16s. */
const BASE_BACKOFF_MS = 2_000;
/** Never sleep longer than this for one retry, whatever Retry-After asks for. */
const MAX_WAIT_MS = 60_000;

/**
 * fetch() that waits and retries when Graph throttles. After a deploy the startup manifest sync
 * and album warming both walk every folder at once, and Graph answers with 429 Too Many Requests
 * and a Retry-After header saying how long to back off. Under that same load a request sometimes
 * just hangs, so timeouts and dropped connections are retried too (every caller is a GET).
 * A fresh timeout signal is made per attempt.
 */
export async function fetchWithRetry(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
        let response: Response;
        try {
            response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
        } catch (err) {
            if (!isTransientFetchError(err) || attempt >= MAX_ATTEMPTS) throw err;
            const waitMs = BASE_BACKOFF_MS * 2 ** (attempt - 1);
            console.log(
                `Graph ${(err as Error).name} on attempt ${attempt}/${MAX_ATTEMPTS}; retrying in ${(waitMs / 1000).toFixed(1)}s`,
            );
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
        }
        if (!RETRYABLE_STATUSES.has(response.status) || attempt >= MAX_ATTEMPTS) return response;

        const waitMs = Math.min(
            retryAfterMs(response.headers.get('Retry-After')) ?? BASE_BACKOFF_MS * 2 ** (attempt - 1),
            MAX_WAIT_MS,
        );
        // Release the connection before sleeping; the body of a throttled response is not needed.
        await response.body?.cancel();
        console.log(
            `Graph ${response.status} on attempt ${attempt}/${MAX_ATTEMPTS}; retrying in ${(waitMs / 1000).toFixed(1)}s`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
}

/** A per-attempt timeout, or undici's "fetch failed" TypeError for a reset or refused connection. */
function isTransientFetchError(err: unknown): boolean {
    return (err instanceof Error && err.name === 'TimeoutError') || err instanceof TypeError;
}

/** Parse a Retry-After header, which is either delay-seconds or an HTTP date. */
function retryAfterMs(header: string | null): number | null {
    if (!header) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(header);
    return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}
