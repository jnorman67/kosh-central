const STORAGE_KEY = 'kosh:recent-mentions';
const MAX_ENTRIES = 15;

interface RecentEntry {
    type: string;
    id: string;
}

export function getRecentMentions(): RecentEntry[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
        return [];
    }
}

export function recordRecentMention(type: string, id: string): void {
    const entries = getRecentMentions().filter((e) => !(e.type === type && e.id === id));
    entries.unshift({ type, id });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}
