import crypto from 'node:crypto';
import { getDb } from './database.js';

export type RelationshipType = 'parent-of' | 'spouse-of' | 'sibling-of' | 'friend-of';
export type SubjectSource = 'manual' | 'auto';

export interface StoredPerson {
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

export interface StoredRelationship {
    id: string;
    fromPersonId: string;
    toPersonId: string;
    relationType: RelationshipType;
    createdAt: string;
    createdBy: string | null;
}

export interface StoredPhotoSubject {
    photoId: string;
    personId: string;
    source: SubjectSource;
    confidence: number | null;
    faceRegion: string | null;
    verified: boolean;
    createdAt: string;
    createdBy: string | null;
}

export interface StoredSeriesSubject {
    seriesId: string;
    personId: string;
    createdAt: string;
    createdBy: string | null;
}

// Symmetric relation types are stored as bidirectional rows.
const SYMMETRIC_TYPES = new Set<RelationshipType>(['spouse-of', 'sibling-of', 'friend-of']);

interface PersonRow {
    id: string;
    full_name: string;
    nickname: string | null;
    birth_year: number | null;
    notes: string | null;
    sex: string | null;
    birth_date: string | null;
    death_date: string | null;
    birth_place: string | null;
    death_place: string | null;
    gedcom_id: string | null;
    created_at: string;
    created_by: string | null;
}

interface RelationshipRow {
    id: string;
    from_person_id: string;
    to_person_id: string;
    relation_type: string;
    created_at: string;
    created_by: string | null;
}

interface PhotoSubjectRow {
    photo_id: string;
    person_id: string;
    source: string;
    confidence: number | null;
    face_region: string | null;
    verified: number;
    created_at: string;
    created_by: string | null;
}

interface SeriesSubjectRow {
    series_id: string;
    person_id: string;
    created_at: string;
    created_by: string | null;
}

function rowToPerson(row: PersonRow): StoredPerson {
    return {
        id: row.id,
        fullName: row.full_name,
        nickname: row.nickname,
        birthYear: row.birth_year,
        notes: row.notes,
        sex: (row.sex as 'M' | 'F' | 'U') ?? null,
        birthDate: row.birth_date,
        deathDate: row.death_date,
        birthPlace: row.birth_place,
        deathPlace: row.death_place,
        gedcomId: row.gedcom_id,
        createdAt: row.created_at,
        createdBy: row.created_by,
    };
}

function rowToRelationship(row: RelationshipRow): StoredRelationship {
    return {
        id: row.id,
        fromPersonId: row.from_person_id,
        toPersonId: row.to_person_id,
        relationType: row.relation_type as RelationshipType,
        createdAt: row.created_at,
        createdBy: row.created_by,
    };
}

function rowToPhotoSubject(row: PhotoSubjectRow): StoredPhotoSubject {
    return {
        photoId: row.photo_id,
        personId: row.person_id,
        source: row.source as SubjectSource,
        confidence: row.confidence,
        faceRegion: row.face_region,
        verified: row.verified === 1,
        createdAt: row.created_at,
        createdBy: row.created_by,
    };
}

function rowToSeriesSubject(row: SeriesSubjectRow): StoredSeriesSubject {
    return {
        seriesId: row.series_id,
        personId: row.person_id,
        createdAt: row.created_at,
        createdBy: row.created_by,
    };
}

// ─── Persons CRUD ─────────────────────────────────────────────────────────────

export function createPerson(
    fullName: string,
    opts: {
        nickname?: string;
        birthYear?: number;
        notes?: string;
        sex?: 'M' | 'F' | 'U';
        birthDate?: string;
        deathDate?: string;
        birthPlace?: string;
        deathPlace?: string;
        gedcomId?: string;
        createdBy?: string;
    } = {},
): StoredPerson {
    const id = crypto.randomUUID();
    getDb()
        .prepare(
            `INSERT INTO persons
             (id, full_name, nickname, birth_year, notes, sex, birth_date, death_date, birth_place, death_place, gedcom_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
            id,
            fullName,
            opts.nickname ?? null,
            opts.birthYear ?? null,
            opts.notes ?? null,
            opts.sex ?? null,
            opts.birthDate ?? null,
            opts.deathDate ?? null,
            opts.birthPlace ?? null,
            opts.deathPlace ?? null,
            opts.gedcomId ?? null,
            opts.createdBy ?? null,
        );
    return findPersonById(id)!;
}

export function findPersonByGedcomId(gedcomId: string): StoredPerson | undefined {
    const row = getDb().prepare('SELECT * FROM persons WHERE gedcom_id = ?').get(gedcomId) as PersonRow | undefined;
    return row ? rowToPerson(row) : undefined;
}

export function findPersonById(id: string): StoredPerson | undefined {
    const row = getDb().prepare('SELECT * FROM persons WHERE id = ?').get(id) as PersonRow | undefined;
    return row ? rowToPerson(row) : undefined;
}

export function listPersons(): StoredPerson[] {
    const rows = getDb().prepare('SELECT * FROM persons ORDER BY full_name').all() as PersonRow[];
    return rows.map(rowToPerson);
}

export function searchPersons(query: string): StoredPerson[] {
    const rows = getDb()
        .prepare(
            "SELECT * FROM persons WHERE full_name LIKE ? OR nickname LIKE ? ORDER BY full_name",
        )
        .all(`%${query}%`, `%${query}%`) as PersonRow[];
    return rows.map(rowToPerson);
}

export function updatePerson(
    id: string,
    updates: {
        fullName?: string;
        nickname?: string | null;
        birthYear?: number | null;
        notes?: string | null;
        sex?: 'M' | 'F' | 'U' | null;
        birthDate?: string | null;
        deathDate?: string | null;
        birthPlace?: string | null;
        deathPlace?: string | null;
    },
): StoredPerson {
    const current = findPersonById(id);
    if (!current) throw new Error(`Person not found: ${id}`);

    getDb()
        .prepare(
            `UPDATE persons SET
             full_name = ?, nickname = ?, birth_year = ?, notes = ?,
             sex = ?, birth_date = ?, death_date = ?, birth_place = ?, death_place = ?
             WHERE id = ?`,
        )
        .run(
            updates.fullName ?? current.fullName,
            'nickname' in updates ? updates.nickname : current.nickname,
            'birthYear' in updates ? updates.birthYear : current.birthYear,
            'notes' in updates ? updates.notes : current.notes,
            'sex' in updates ? updates.sex : current.sex,
            'birthDate' in updates ? updates.birthDate : current.birthDate,
            'deathDate' in updates ? updates.deathDate : current.deathDate,
            'birthPlace' in updates ? updates.birthPlace : current.birthPlace,
            'deathPlace' in updates ? updates.deathPlace : current.deathPlace,
            id,
        );
    return findPersonById(id)!;
}

export function deletePerson(id: string): boolean {
    const result = getDb().prepare('DELETE FROM persons WHERE id = ?').run(id);
    return result.changes > 0;
}

// ─── Relationships ────────────────────────────────────────────────────────────

/**
 * Add a relationship. For symmetric types (spouse-of, sibling-of, friend-of)
 * both directions are written in a single transaction. For parent-of only the
 * forward row is written.
 */
export function addRelationship(
    fromPersonId: string,
    toPersonId: string,
    relationType: RelationshipType,
    createdBy?: string,
): StoredRelationship {
    const db = getDb();
    const forwardId = crypto.randomUUID();
    const by = createdBy ?? null;

    if (SYMMETRIC_TYPES.has(relationType)) {
        const inverseId = crypto.randomUUID();
        db.transaction(() => {
            db.prepare(
                'INSERT INTO person_relationships (id, from_person_id, to_person_id, relation_type, created_by) VALUES (?, ?, ?, ?, ?)',
            ).run(forwardId, fromPersonId, toPersonId, relationType, by);
            db.prepare(
                'INSERT INTO person_relationships (id, from_person_id, to_person_id, relation_type, created_by) VALUES (?, ?, ?, ?, ?)',
            ).run(inverseId, toPersonId, fromPersonId, relationType, by);
        })();
    } else {
        db.prepare(
            'INSERT INTO person_relationships (id, from_person_id, to_person_id, relation_type, created_by) VALUES (?, ?, ?, ?, ?)',
        ).run(forwardId, fromPersonId, toPersonId, relationType, by);
    }

    return rowToRelationship(
        db.prepare('SELECT * FROM person_relationships WHERE id = ?').get(forwardId) as RelationshipRow,
    );
}

export function findRelationshipById(id: string): StoredRelationship | undefined {
    const row = getDb().prepare('SELECT * FROM person_relationships WHERE id = ?').get(id) as
        | RelationshipRow
        | undefined;
    return row ? rowToRelationship(row) : undefined;
}

/** Get all relationships originating from this person. */
export function getRelationshipsForPerson(personId: string): StoredRelationship[] {
    const rows = getDb()
        .prepare('SELECT * FROM person_relationships WHERE from_person_id = ? ORDER BY relation_type, created_at')
        .all(personId) as RelationshipRow[];
    return rows.map(rowToRelationship);
}

/**
 * Delete a relationship by its id. For symmetric types, the inverse row is
 * also removed in the same transaction.
 */
export function deleteRelationship(id: string): boolean {
    const db = getDb();
    const forward = db.prepare('SELECT * FROM person_relationships WHERE id = ?').get(id) as
        | RelationshipRow
        | undefined;
    if (!forward) return false;

    if (SYMMETRIC_TYPES.has(forward.relation_type as RelationshipType)) {
        db.transaction(() => {
            db.prepare('DELETE FROM person_relationships WHERE id = ?').run(id);
            db.prepare(
                'DELETE FROM person_relationships WHERE from_person_id = ? AND to_person_id = ? AND relation_type = ?',
            ).run(forward.to_person_id, forward.from_person_id, forward.relation_type);
        })();
    } else {
        db.prepare('DELETE FROM person_relationships WHERE id = ?').run(id);
    }

    return true;
}

// ─── Photo subjects ───────────────────────────────────────────────────────────

export function addPhotoSubject(
    photoId: string,
    personId: string,
    opts: {
        source?: SubjectSource;
        confidence?: number;
        faceRegion?: string;
        createdBy?: string;
    } = {},
): StoredPhotoSubject {
    const source = opts.source ?? 'manual';
    const verified = source === 'manual' ? 1 : 0;
    getDb()
        .prepare(
            `INSERT INTO photo_subjects
             (photo_id, person_id, source, confidence, face_region, verified, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
            photoId,
            personId,
            source,
            opts.confidence ?? null,
            opts.faceRegion ?? null,
            verified,
            opts.createdBy ?? null,
        );
    const row = getDb()
        .prepare('SELECT * FROM photo_subjects WHERE photo_id = ? AND person_id = ?')
        .get(photoId, personId) as PhotoSubjectRow;
    return rowToPhotoSubject(row);
}

export function getPeopleForPhoto(photoId: string): StoredPhotoSubject[] {
    const rows = getDb()
        .prepare('SELECT * FROM photo_subjects WHERE photo_id = ? ORDER BY created_at')
        .all(photoId) as PhotoSubjectRow[];
    return rows.map(rowToPhotoSubject);
}

export function getPhotosForPerson(personId: string): StoredPhotoSubject[] {
    const rows = getDb()
        .prepare('SELECT * FROM photo_subjects WHERE person_id = ? ORDER BY created_at')
        .all(personId) as PhotoSubjectRow[];
    return rows.map(rowToPhotoSubject);
}

export function verifyPhotoSubject(photoId: string, personId: string): boolean {
    const result = getDb()
        .prepare('UPDATE photo_subjects SET verified = 1 WHERE photo_id = ? AND person_id = ?')
        .run(photoId, personId);
    return result.changes > 0;
}

export function removePhotoSubject(photoId: string, personId: string): boolean {
    const result = getDb()
        .prepare('DELETE FROM photo_subjects WHERE photo_id = ? AND person_id = ?')
        .run(photoId, personId);
    return result.changes > 0;
}

// ─── Series subjects ──────────────────────────────────────────────────────────

export function addSeriesSubject(seriesId: string, personId: string, createdBy?: string): StoredSeriesSubject {
    getDb()
        .prepare('INSERT INTO series_subjects (series_id, person_id, created_by) VALUES (?, ?, ?)')
        .run(seriesId, personId, createdBy ?? null);
    const row = getDb()
        .prepare('SELECT * FROM series_subjects WHERE series_id = ? AND person_id = ?')
        .get(seriesId, personId) as SeriesSubjectRow;
    return rowToSeriesSubject(row);
}

export function getPersonsForSeries(seriesId: string): StoredSeriesSubject[] {
    const rows = getDb()
        .prepare('SELECT * FROM series_subjects WHERE series_id = ? ORDER BY created_at')
        .all(seriesId) as SeriesSubjectRow[];
    return rows.map(rowToSeriesSubject);
}

export function getSeriesForPerson(personId: string): StoredSeriesSubject[] {
    const rows = getDb()
        .prepare('SELECT * FROM series_subjects WHERE person_id = ? ORDER BY created_at')
        .all(personId) as SeriesSubjectRow[];
    return rows.map(rowToSeriesSubject);
}

export function removeSeriesSubject(seriesId: string, personId: string): boolean {
    const result = getDb()
        .prepare('DELETE FROM series_subjects WHERE series_id = ? AND person_id = ?')
        .run(seriesId, personId);
    return result.changes > 0;
}
