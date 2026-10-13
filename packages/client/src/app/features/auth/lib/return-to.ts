/**
 * The sign-in page for someone who landed on `target` signed out. A link someone shared (a
 * gallery, a photo) should open once they've signed in; the bare home page goes through the
 * usual post-sign-in featured page instead.
 */
export function loginPathFor(target: string): string {
    return target === '/' ? '/login' : `/login?next=${encodeURIComponent(target)}`;
}

/** Where to go after signing in, from the sign-in page's `next` param: only a path on this site. */
export function readReturnTo(params: URLSearchParams): string | null {
    const next = params.get('next');
    return next?.startsWith('/') && !next.startsWith('//') ? next : null;
}
