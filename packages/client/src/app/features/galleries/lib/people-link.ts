import type { GalleryMatchMode } from '@/app/features/galleries/models/galleries.models';
import type { PickedPerson } from '@/app/features/photos/components/persons-picker';
import { useMemo } from 'react';

const NAME_MAX = 100;

const PEOPLE_PARAM = 'people';
const MATCH_PARAM = 'match';
const NAME_PARAM = 'name';

/**
 * A people gallery described in the URL instead of saved: what a shared gallery link opens. It
 * lives only in the link, so there's nothing to expire or clean up; the recipient can save a copy.
 */
export interface PeopleLink {
    /** In the order the sharer listed them. */
    personIds: string[];
    matchMode: GalleryMatchMode;
    /** The sharer's name for the gallery; when absent, it's named after its people. */
    name: string | null;
}

/** The name a gallery gets when the user leaves it blank, e.g. "Ann, Bob and Carol". */
export function defaultGalleryName(persons: PickedPerson[]): string {
    return new Intl.ListFormat('en', { type: 'conjunction' }).format(persons.map((p) => p.nickname || p.fullName)).slice(0, NAME_MAX);
}

function parsePeopleLink(people: string | null, match: string | null, name: string | null): PeopleLink | null {
    const personIds = [...new Set((people ?? '').split(',').filter(Boolean))];
    if (personIds.length === 0) return null;
    return {
        personIds,
        matchMode: match === 'all' ? 'all' : 'any',
        name: name?.trim().slice(0, NAME_MAX) || null,
    };
}

/** The people link the URL points at, if it isn't pointing at an album or a saved gallery. Kept
 *  the same object while the link's own params are unchanged, e.g. while stepping through photos. */
export function usePeopleLink(params: URLSearchParams): PeopleLink | null {
    const elsewhere = !!(params.get('folder') || params.get('gallery'));
    const people = params.get(PEOPLE_PARAM);
    const match = params.get(MATCH_PARAM);
    const name = params.get(NAME_PARAM);
    return useMemo(() => (elsewhere ? null : parsePeopleLink(people, match, name)), [elsewhere, people, match, name]);
}

export function writePeopleLink(params: URLSearchParams, link: PeopleLink): void {
    params.set(PEOPLE_PARAM, link.personIds.join(','));
    if (link.matchMode === 'all' && link.personIds.length > 1) params.set(MATCH_PARAM, 'all');
    if (link.name) params.set(NAME_PARAM, link.name);
}

/** Identifies the photos a link shows, for caching and scroll memory; the name doesn't change them. */
export function peopleLinkKey(link: PeopleLink): string {
    return `${link.matchMode}:${link.personIds.join(',')}`;
}

/** The address to share for a gallery. A name that just lists its people is left out of the link. */
export function peopleLinkUrl({
    persons,
    matchMode,
    name,
}: {
    persons: PickedPerson[];
    matchMode: GalleryMatchMode;
    name: string;
}): string {
    const params = new URLSearchParams();
    writePeopleLink(params, {
        personIds: persons.map((p) => p.id),
        matchMode,
        name: name === defaultGalleryName(persons) ? null : name,
    });
    // Commas are safe in a query string; leaving them unescaped keeps a pasted link readable.
    return `${window.location.origin}/?${params.toString().replaceAll('%2C', ',')}`;
}
