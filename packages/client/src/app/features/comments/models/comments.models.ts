export type MentionType = 'user' | 'person';

export interface Mention {
    commentId: string;
    mentionType: MentionType;
    mentionedId: string;
}

export interface Comment {
    id: string;
    photoId: string;
    authorId: string;
    authorDisplayName: string;
    body: string;
    createdAt: string;
    editedAt: string | null;
    mentions: Mention[];
}

export interface MentionInput {
    mentionType: MentionType;
    mentionedId: string;
}

export interface MentionCandidate {
    type: MentionType;
    id: string;
    displayLabel: string;
    insertLabel: string;
    nickname?: string;
    portraitThumbUrl?: string;
    birthYear?: number | null;
    birthDate?: string | null;
    deathDate?: string | null;
    birthPlace?: string | null;
}
