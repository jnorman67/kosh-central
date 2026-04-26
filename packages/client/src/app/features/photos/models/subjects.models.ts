export interface PhotoSubject {
    photoId: string;
    personId: string;
    fullName: string;
    nickname: string | null;
    source: 'manual' | 'auto';
    verified: boolean;
    createdAt: string;
}

export interface SubjectSuggestion {
    id: string;
    fullName: string;
    nickname: string | null;
    mentionCount: number;
}
