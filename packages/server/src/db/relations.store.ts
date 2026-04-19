import crypto from 'node:crypto';
import { getDb } from './database.js';

// Bundle membership (front/back, original/enhanced) is now modeled via the
// `bundles` table; the only relation type that survives is cross-bundle
// duplicate tracking.
export type RelationType = 'duplicate-of';

const INVERSE_MAP: Record<RelationType, RelationType> = {
    'duplicate-of': 'duplicate-of',
};

export interface StoredRelation {
    id: string;
    photoId: string;
    relatedPhotoId: string;
    relationType: RelationType;
    createdAt: string;
    createdBy: string | null;
}

interface RelationRow {
    id: string;
    photo_id: string;
    related_photo_id: string;
    relation_type: string;
    created_at: string;
    created_by: string | null;
}

function rowToRelation(row: RelationRow): StoredRelation {
    return {
        id: row.id,
        photoId: row.photo_id,
        relatedPhotoId: row.related_photo_id,
        relationType: row.relation_type as RelationType,
        createdAt: row.created_at,
        createdBy: row.created_by,
    };
}

/** Get all relations where the given photo is the subject. */
export function getRelationsForPhoto(photoId: string): StoredRelation[] {
    const rows = getDb()
        .prepare('SELECT * FROM photo_relations WHERE photo_id = ? ORDER BY relation_type, created_at')
        .all(photoId) as RelationRow[];
    return rows.map(rowToRelation);
}

/**
 * Create a relation and its inverse in a single transaction.
 * Returns the forward relation.
 */
export function createRelation(
    photoId: string,
    relatedPhotoId: string,
    relationType: RelationType,
    createdBy: string | null,
): StoredRelation {
    const db = getDb();
    const forwardId = crypto.randomUUID();
    const inverseId = crypto.randomUUID();
    const inverseType = INVERSE_MAP[relationType];

    const insertBoth = db.transaction(() => {
        db.prepare(
            'INSERT INTO photo_relations (id, photo_id, related_photo_id, relation_type, created_by) VALUES (?, ?, ?, ?, ?)',
        ).run(forwardId, photoId, relatedPhotoId, relationType, createdBy);

        db.prepare(
            'INSERT INTO photo_relations (id, photo_id, related_photo_id, relation_type, created_by) VALUES (?, ?, ?, ?, ?)',
        ).run(inverseId, relatedPhotoId, photoId, inverseType, createdBy);
    });

    insertBoth();

    const row = db.prepare('SELECT * FROM photo_relations WHERE id = ?').get(forwardId) as RelationRow;
    return rowToRelation(row);
}

/**
 * Delete a relation and its inverse in a single transaction.
 * Pass the forward relation's id — the inverse is found and removed automatically.
 */
export function deleteRelation(relationId: string): boolean {
    const db = getDb();
    const forward = db.prepare('SELECT * FROM photo_relations WHERE id = ?').get(relationId) as RelationRow | undefined;
    if (!forward) return false;

    const inverseType = INVERSE_MAP[forward.relation_type as RelationType];

    const deleteBoth = db.transaction(() => {
        db.prepare('DELETE FROM photo_relations WHERE id = ?').run(relationId);
        db.prepare(
            'DELETE FROM photo_relations WHERE photo_id = ? AND related_photo_id = ? AND relation_type = ?',
        ).run(forward.related_photo_id, forward.photo_id, inverseType);
    });

    deleteBoth();
    return true;
}

export function findRelationById(id: string): StoredRelation | undefined {
    const row = getDb().prepare('SELECT * FROM photo_relations WHERE id = ?').get(id) as RelationRow | undefined;
    return row ? rowToRelation(row) : undefined;
}
