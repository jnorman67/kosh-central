/** Thrown when the server returns a non-2xx response. Carries the HTTP status so callers (and
 *  the global React Query handler in app.tsx) can react to 401/403 etc. The optional `field`
 *  lets form-level validation errors surface on the offending input. */
export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public field?: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

interface ErrorBody {
    error?: string;
    field?: string;
}

/** Wraps `fetch` with JSON parsing and throws `ApiError` on non-2xx. Returns `undefined` for
 *  empty 204 responses; callers that expect no body should type the call as `apiFetch<void>`. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (res.status === 204) return undefined as T;

    let body: unknown;
    try {
        body = await res.json();
    } catch {
        body = undefined;
    }

    if (!res.ok) {
        const err = (body ?? {}) as ErrorBody;
        throw new ApiError(err.error ?? `Request failed (${res.status})`, res.status, err.field);
    }

    return body as T;
}
