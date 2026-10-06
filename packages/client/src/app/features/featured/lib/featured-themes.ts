import type { FeaturedContent, FeaturedTheme } from '@/app/features/featured/models/featured.models';
import { Flower2, PartyPopper, type LucideIcon } from 'lucide-react';

export const DEFAULT_BUTTON_LABEL = 'View the album';

export interface FeaturedThemeStyle {
    label: string;
    description: string;
    /** Decoration drawn between the subtitle and the message: an icon, a text glyph, or nothing. */
    ornament: LucideIcon | string | null;
    /** Example text the admin form shows as placeholders for this theme. */
    examples: Omit<FeaturedContent, 'theme'>;
    /** Swatch for the theme picker. */
    swatch: string;
    classes: {
        page: string;
        eyebrow: string;
        title: string;
        subtitle: string;
        message: string;
        frame: string;
        ornament: string;
        rule: string;
        primaryButton: string;
        secondaryButton: string;
    };
}

// Class strings are written out in full so Tailwind's scanner picks them up.
export const FEATURED_THEMES: Record<FeaturedTheme, FeaturedThemeStyle> = {
    classic: {
        label: 'Classic',
        description: 'Warm amber, matches the rest of the site',
        ornament: null,
        examples: {
            eyebrow: 'Featured album',
            title: 'Summers at the lake',
            subtitle: '1958 – 1972',
            message: 'A few words about why this album is worth a look…',
            buttonLabel: 'See all the photos',
        },
        swatch: 'bg-gradient-to-b from-amber-100 to-white',
        classes: {
            page: 'bg-gradient-to-b from-amber-50 to-background text-foreground',
            eyebrow: 'text-xs font-semibold uppercase tracking-[0.25em] text-amber-700',
            title: 'font-serif font-semibold text-foreground',
            subtitle: 'text-muted-foreground',
            message: 'text-foreground/80',
            frame: 'rounded-sm bg-white p-2 shadow-lg ring-1 ring-amber-200',
            ornament: 'text-amber-500',
            rule: 'bg-amber-300',
            primaryButton: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
            secondaryButton: 'text-muted-foreground hover:bg-amber-100 hover:text-foreground',
        },
    },
    memorial: {
        label: 'Memorial',
        description: 'Quiet and dark, for remembering someone',
        ornament: Flower2,
        examples: {
            eyebrow: 'In loving memory',
            title: 'Full name',
            subtitle: 'March 3, 1931 – August 12, 2026',
            message: 'A few words about them…',
            buttonLabel: 'View their photos',
        },
        swatch: 'bg-gradient-to-b from-zinc-700 to-zinc-950',
        classes: {
            page: 'bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100',
            eyebrow: 'text-xs uppercase tracking-[0.35em] text-zinc-400',
            title: 'font-serif font-light tracking-wide text-zinc-50',
            subtitle: 'font-serif italic text-zinc-400',
            message: 'font-serif text-zinc-300',
            frame: 'bg-zinc-800/60 p-2 shadow-2xl ring-1 ring-zinc-700',
            ornament: 'text-zinc-500',
            rule: 'bg-zinc-700',
            primaryButton: 'border border-zinc-500 bg-transparent text-zinc-100 hover:bg-zinc-800',
            secondaryButton: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
        },
    },
    celebration: {
        label: 'Celebration',
        description: 'Bright and festive, for birthdays, weddings, reunions',
        ornament: PartyPopper,
        examples: {
            eyebrow: 'Happy 90th birthday!',
            title: 'Grandma Ruth',
            subtitle: 'October 12, 2026',
            message: 'Ninety years of photos — share your favorites and leave her a note…',
            buttonLabel: 'See the photos',
        },
        swatch: 'bg-gradient-to-br from-rose-300 via-amber-200 to-sky-300',
        classes: {
            page: 'bg-gradient-to-br from-rose-100 via-amber-50 to-sky-100 text-zinc-900',
            eyebrow: 'text-sm font-bold uppercase tracking-[0.2em] text-rose-600',
            title: 'font-extrabold tracking-tight text-zinc-900',
            subtitle: 'font-medium text-sky-700',
            message: 'text-zinc-700',
            frame: '-rotate-1 rounded-md bg-white p-3 shadow-xl ring-1 ring-rose-200',
            ornament: 'text-rose-500',
            rule: 'bg-gradient-to-r from-rose-300 via-amber-300 to-sky-300',
            primaryButton: 'bg-rose-600 text-white shadow hover:bg-rose-500',
            secondaryButton: 'text-zinc-600 hover:bg-white/60 hover:text-zinc-900',
        },
    },
    vintage: {
        label: 'Vintage',
        description: 'Old paper and serif type, for family history',
        ornament: '❦',
        examples: {
            eyebrow: 'From the family archives',
            title: 'The Norman homestead',
            subtitle: 'circa 1925',
            message: 'Where the photos came from, who is in them…',
            buttonLabel: 'Browse the album',
        },
        swatch: 'bg-[#e9dcc0]',
        classes: {
            page: 'bg-[#f1e7d3] text-stone-800',
            eyebrow: 'font-serif text-sm italic text-stone-600',
            title: 'font-serif text-stone-900',
            subtitle: 'font-serif text-stone-600',
            message: 'font-serif text-stone-700',
            frame: 'bg-[#fbf7ee] p-3 pb-8 shadow-[0_8px_24px_rgba(68,48,20,0.25)]',
            ornament: 'text-stone-500',
            rule: 'bg-stone-400',
            primaryButton: 'bg-stone-800 text-stone-50 shadow hover:bg-stone-700',
            secondaryButton: 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900',
        },
    },
};

export const FEATURED_THEME_ORDER: FeaturedTheme[] = ['classic', 'memorial', 'celebration', 'vintage'];
