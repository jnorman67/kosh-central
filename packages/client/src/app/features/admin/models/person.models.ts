export interface AdminPerson {
    id: string;
    fullName: string;
    nickname: string | null;
    birthYear: number | null;
    notes: string | null;
    sex: 'M' | 'F' | 'U' | null;
    birthDate: string | null;
    deathDate: string | null;
    birthPlace: string | null;
    deathPlace: string | null;
    gedcomId: string | null;
    createdAt: string;
    createdBy: string | null;
}

export interface PersonRelationship {
    id: string;
    fromPersonId: string;
    toPersonId: string;
    relationType: 'parent-of' | 'spouse-of' | 'sibling-of' | 'friend-of';
    createdAt: string;
    createdBy: string | null;
}

export interface PersonInput {
    fullName: string;
    nickname?: string | null;
    birthYear?: number | null;
    birthDate?: string | null;
    birthPlace?: string | null;
    deathDate?: string | null;
    deathPlace?: string | null;
    sex?: 'M' | 'F' | 'U' | null;
    notes?: string | null;
}
