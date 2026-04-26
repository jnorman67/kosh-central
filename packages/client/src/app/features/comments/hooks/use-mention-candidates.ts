import { apiFetch } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { MentionCandidate } from '../models/comments.models';
import { useCommentsQueries } from '../contexts/comments-query.context';

interface PersonResult {
    id: string;
    fullName: string;
    nickname: string | null;
    portraitPhotoId: string | null;
    birthYear: number | null;
    birthDate: string | null;
    deathDate: string | null;
    birthPlace: string | null;
}

export function useMentionCandidates(): MentionCandidate[] {
    const { useGetUsers } = useCommentsQueries();
    const { data: users = [] } = useGetUsers();
    const { data: persons = [] } = useQuery({
        queryKey: ['Persons', 'All'],
        queryFn: () => apiFetch<PersonResult[]>('/api/persons'),
        staleTime: 5 * 60 * 1000,
    });

    return useMemo(
        () => [
            ...users.map((u) => ({
                type: 'user' as const,
                id: u.id,
                displayLabel: u.displayName,
                insertLabel: u.displayName,
            })),
            ...persons.map((p) => ({
                type: 'person' as const,
                id: p.id,
                displayLabel: p.fullName,
                insertLabel: p.fullName,
                nickname: p.nickname ?? undefined,
                portraitThumbUrl: p.portraitPhotoId ? `/api/persons/${encodeURIComponent(p.id)}/portrait-thumb` : undefined,
                birthYear: p.birthYear,
                birthDate: p.birthDate,
                deathDate: p.deathDate,
                birthPlace: p.birthPlace,
            })),
        ],
        [users, persons],
    );
}
