#!/usr/bin/env npx tsx
/**
 * Import a GEDCOM 5.5 file into the persons catalog.
 *
 * Reads INDI (individual) and FAM (family) records and creates:
 *   - persons rows for each individual
 *   - person_relationships rows (spouse-of, parent-of) derived from FAM records
 *
 * The import is idempotent: persons are matched by gedcom_id, so re-running
 * will update existing rows rather than creating duplicates.
 *
 * GEDCOM data NOT currently stored (noted for future expansion):
 *   - Marriage dates and places (on FAM records; no field on person_relationships)
 *   - Burial info (BURI tag)
 *   - Nationalities (NATI tag)
 *   - Biographical events (EVEN tag)
 *   - MyHeritage media URLs (OBJE tags)
 *
 * Usage:
 *   npx tsx scripts/import-gedcom.ts <path-to-file.ged> [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from '../src/db/database.js';
import {
    addRelationship,
    createPerson,
    findPersonByGedcomId,
    updatePerson,
} from '../src/db/persons.store.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const gedFile = args.find((a) => !a.startsWith('--'));

if (!gedFile) {
    console.error('Usage: npx tsx scripts/import-gedcom.ts <path-to-file.ged> [--dry-run]');
    process.exit(1);
}

const gedPath = path.resolve(process.cwd(), gedFile);
if (!fs.existsSync(gedPath)) {
    console.error(`File not found: ${gedPath}`);
    process.exit(1);
}

// ─── GEDCOM parser ────────────────────────────────────────────────────────────

interface GedcomLine {
    level: number;
    xref: string | null;  // e.g. "@I1@" — only on level-0 records
    tag: string;
    value: string;
}

function parseLines(text: string): GedcomLine[] {
    return text
        .split(/\r?\n/)
        .map((raw) => raw.replace(/^﻿/, '').trim()) // strip BOM and whitespace
        .filter(Boolean)
        .map((line) => {
            const match = line.match(/^(\d+)\s+(@[^@]+@)?\s*(\w+)(?:\s+(.*))?$/);
            if (!match) return null;
            return {
                level: parseInt(match[1], 10),
                xref: match[2] ?? null,
                tag: match[3],
                value: (match[4] ?? '').trim(),
            };
        })
        .filter((l): l is GedcomLine => l !== null);
}

interface GedcomRecord {
    id: string;       // e.g. "@I1@"
    type: string;     // "INDI" or "FAM"
    lines: GedcomLine[];
}

function groupRecords(lines: GedcomLine[]): GedcomRecord[] {
    const records: GedcomRecord[] = [];
    let current: GedcomRecord | null = null;

    for (const line of lines) {
        if (line.level === 0 && line.xref) {
            if (current) records.push(current);
            current = { id: line.xref, type: line.tag, lines: [] };
        } else if (current) {
            current.lines.push(line);
        }
    }
    if (current) records.push(current);
    return records;
}

// Get all values under a given tag path within a record's lines.
// e.g. getTag(lines, 'BIRT', 'DATE') returns the first DATE value under BIRT.
function getSubValue(lines: GedcomLine[], parentTag: string, childTag: string): string | null {
    let inParent = false;
    for (const line of lines) {
        if (line.level === 1 && line.tag === parentTag) {
            inParent = true;
            continue;
        }
        if (inParent) {
            if (line.level === 1) inParent = false;
            else if (line.level === 2 && line.tag === childTag) return line.value || null;
        }
    }
    return null;
}

function getValues(lines: GedcomLine[], tag: string, level = 1): string[] {
    return lines.filter((l) => l.level === level && l.tag === tag).map((l) => l.value);
}

function getValue(lines: GedcomLine[], tag: string, level = 1): string | null {
    return getValues(lines, tag, level)[0] ?? null;
}

// Extract 4-digit year from a GEDCOM date string like "25 JUN 1940", "ABT 1940", "1940"
function extractYear(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const m = dateStr.match(/\b(\d{4})\b/);
    return m ? parseInt(m[1], 10) : null;
}

// Parse GEDCOM NAME tag: "Donald McGee /Norman/" → "Donald McGee Norman"
// Preserves the full name but removes the slashes around the surname.
function parseName(nameValue: string): string {
    return nameValue.replace(/\//g, '').replace(/\s+/g, ' ').trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`Reading ${gedPath}...`);
const text = fs.readFileSync(gedPath, 'utf-8');
const lines = parseLines(text);
const records = groupRecords(lines);

const individuals = records.filter((r) => r.type === 'INDI');
const families = records.filter((r) => r.type === 'FAM');

console.log(`Found ${individuals.length} individuals, ${families.length} families`);
if (dryRun) console.log('(dry-run — no DB writes)');

if (!dryRun) {
    // Resolve DB path relative to this script: scripts/ → server/
    const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    process.env.KOSH_DB_PATH = process.env.KOSH_DB_PATH ?? path.join(serverRoot, 'kosh.db');
    initDb();
}

// Pass 1: create or update persons
const gedcomToDbId = new Map<string, string>(); // "@I1@" → uuid

let created = 0;
let updated = 0;

for (const rec of individuals) {
    const rawName = getValue(rec.lines, 'NAME') ?? '(unknown)';
    const fullName = parseName(rawName);
    const sexRaw = getValue(rec.lines, 'SEX');
    const sex = sexRaw === 'M' ? 'M' : sexRaw === 'F' ? 'F' : sexRaw ? 'U' : null;
    const birthDate = getSubValue(rec.lines, 'BIRT', 'DATE');
    const birthPlace = getSubValue(rec.lines, 'BIRT', 'PLAC');
    const deathDate = getSubValue(rec.lines, 'DEAT', 'DATE');
    const deathPlace = getSubValue(rec.lines, 'DEAT', 'PLAC');
    const birthYear = extractYear(birthDate);

    // Collect notes (NOTE tags, EVEN entries)
    const noteParts: string[] = [];
    for (const line of rec.lines) {
        if (line.level === 1 && line.tag === 'NOTE' && line.value) noteParts.push(line.value);
    }
    const notes = noteParts.length > 0 ? noteParts.join('\n') : null;

    if (dryRun) {
        console.log(`  ${rec.id}: ${fullName} (${sex ?? '?'}) b.${birthDate ?? '?'} d.${deathDate ?? '?'}`);
        gedcomToDbId.set(rec.id, rec.id); // placeholder for dry-run relationship logging
        continue;
    }

    const existing = findPersonByGedcomId(rec.id);
    if (existing) {
        updatePerson(existing.id, { fullName, sex, birthDate, birthPlace, deathDate, deathPlace });
        // birthYear stored separately; update if changed
        if (birthYear !== existing.birthYear) {
            updatePerson(existing.id, { birthYear: birthYear ?? undefined });
        }
        gedcomToDbId.set(rec.id, existing.id);
        updated++;
    } else {
        const person = createPerson(fullName, {
            sex: sex ?? undefined,
            birthDate: birthDate ?? undefined,
            birthPlace: birthPlace ?? undefined,
            deathDate: deathDate ?? undefined,
            deathPlace: deathPlace ?? undefined,
            birthYear: birthYear ?? undefined,
            notes: notes ?? undefined,
            gedcomId: rec.id,
        });
        gedcomToDbId.set(rec.id, person.id);
        created++;
    }
}

console.log(`Persons: ${created} created, ${updated} updated`);

// Pass 2: create relationships from FAM records
let relsCreated = 0;
let relsSkipped = 0;

for (const fam of families) {
    const husbGedId = getValue(fam.lines, 'HUSB')?.replace(/\s/g, '') ?? null;
    const wifeGedId = getValue(fam.lines, 'WIFE')?.replace(/\s/g, '') ?? null;
    const childGedIds = getValues(fam.lines, 'CHIL').map((v) => v.replace(/\s/g, ''));

    const husbDbId = husbGedId ? gedcomToDbId.get(husbGedId) : null;
    const wifeDbId = wifeGedId ? gedcomToDbId.get(wifeGedId) : null;

    if (dryRun) {
        if (husbGedId && wifeGedId) console.log(`  FAM ${fam.id}: ${husbGedId} spouse-of ${wifeGedId}`);
        for (const c of childGedIds) {
            if (husbGedId) console.log(`  FAM ${fam.id}: ${husbGedId} parent-of ${c}`);
            if (wifeGedId) console.log(`  FAM ${fam.id}: ${wifeGedId} parent-of ${c}`);
        }
        continue;
    }

    // Spouse relationship (symmetric — addRelationship writes both directions)
    if (husbDbId && wifeDbId) {
        try {
            addRelationship(husbDbId, wifeDbId, 'spouse-of');
            relsCreated += 2; // forward + inverse
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes('UNIQUE')) relsSkipped++;
            else throw err;
        }
    }

    // Parent-child relationships
    for (const childGedId of childGedIds) {
        const childDbId = gedcomToDbId.get(childGedId);
        if (!childDbId) continue;

        for (const parentDbId of [husbDbId, wifeDbId]) {
            if (!parentDbId) continue;
            try {
                addRelationship(parentDbId, childDbId, 'parent-of');
                relsCreated++;
            } catch (err: unknown) {
                if (err instanceof Error && err.message.includes('UNIQUE')) relsSkipped++;
                else throw err;
            }
        }
    }
}

console.log(`Relationships: ${relsCreated} created, ${relsSkipped} skipped (already exist)`);
console.log('Done.');
