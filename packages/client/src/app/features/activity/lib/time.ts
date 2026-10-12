/** SQLite's datetime('now') is UTC without a zone ("2026-04-26 16:07:23"); browsers would read it as local time. */
export function parseServerDate(value: string): Date {
    return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "just now", "5 minutes ago", "yesterday", then a plain date once it's over a week old. */
export function formatSince(value: string, now = Date.now()): string {
    const date = parseServerDate(value);
    const seconds = Math.round((now - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return relative.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return relative.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    if (days < 7) return relative.format(-days, 'day');
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
    });
}
