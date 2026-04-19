/**
 * Derive a slug suggestion from a free-form display name.
 * Lowercases, replaces non-alphanumeric runs with hyphens, trims edge hyphens.
 */
export function slugify(displayName: string): string {
    return displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
