export interface PhotoSubject {
    photoId: string;
    personId: string;
    fullName: string;
    nickname: string | null;
    /** The person was suggested by a user and isn't yet approved into the index. */
    proposed: boolean;
    source: 'manual' | 'auto';
    verified: boolean;
    createdAt: string;
    createdBy: string | null;
}

export interface SubjectSuggestion {
    id: string;
    fullName: string;
    nickname: string | null;
    mentionCount: number;
}
