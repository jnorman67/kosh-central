#!/usr/bin/env npx tsx
/**
 * Import a GEDCOM 5.5 file into the persons catalog with full reconciliation.
 *
 * Match priority for each INDI record (stops at first hit):
 *   1. gedcom_uid match (_UID field) — same-source re-export, high confidence
 *   2. Name + exact birth date match  — cross-source, high confidence
 *   3. Name + birth year match        — medium confidence, flags needs_review
 *   4. No match                       — inserts new person, flags new
 *
 * Existing associations (photo tags, series tags, relationships) are never
 * touched — only genealogical fields are updated on matched persons.
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
    confirmPersonImport,
    createPerson,
    findPersonByGedcomUid,
    findPersonByNameAndBirthDate,
    findPersonsByNameAndBirthYear,
    updatePerson,
    type ImportStatus,
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
    xref: string | null;
    tag: string;
    value: string;
}

function parseLines(text: string): GedcomLine[] {
    return text
        .split(/\r?\n/)
        .map((raw) => raw.replace(/^﻿/, '').trim())
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
    id: string;
    type: string;
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

function getSubValue(lines: GedcomLine[], parentTag: string, childTag: string): string | null {
    let inParent = false;
    for (const line of lines) {
        if (line.level === 1 && line.tag === parentTag) { inParent = true; continue; }
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

function extractYear(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const m = dateStr.match(/\b(\d{4})\b/);
    return m ? parseInt(m[1], 10) : null;
}

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
    const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    process.env.KOSH_DB_PATH = process.env.KOSH_DB_PATH ?? path.join(serverRoot, 'kosh.db');
    initDb();
}

// Pass 1: reconcile persons
const gedcomToDbId = new Map<string, string>();

const counts = { uid: 0, date: 0, year: 0, created: 0 };
const needsReview: { name: string; reason: string }[] = [];

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
    const gedcomUid = getValue(rec.lines, '_UID');

    const noteParts: string[] = [];
    for (const line of rec.lines) {
        if (line.level === 1 && line.tag === 'NOTE' && line.value) noteParts.push(line.value);
    }
    const notes = noteParts.length > 0 ? noteParts.join('\n') : null;

    const fields = { fullName, sex: sex ?? undefined, birthDate: birthDate ?? undefined, birthPlace: birthPlace ?? undefined, deathDate: deathDate ?? undefined, deathPlace: deathPlace ?? undefined, birthYear: birthYear ?? undefined, notes: notes ?? undefined };

    if (dryRun) {
        console.log(`  ${rec.id}: ${fullName} (${sex ?? '?'}) b.${birthDate ?? '?'} uid:${gedcomUid ?? 'none'}`);
        gedcomToDbId.set(rec.id, rec.id);
        continue;
    }

    // ── 1. Match by _UID (same-source re-export) ──────────────────────────────
    if (gedcomUid) {
        const existing = findPersonByGedcomUid(gedcomUid);
        if (existing) {
            updatePerson(existing.id, { ...fields, gedcomUid, importStatus: 'confirmed' });
            gedcomToDbId.set(rec.id, existing.id);
            counts.uid++;
            continue;
        }
    }

    // ── 2. Match by name + exact birth date ───────────────────────────────────
    if (birthDate) {
        const existing = findPersonByNameAndBirthDate(fullName, birthDate);
        if (existing) {
            updatePerson(existing.id, { ...fields, gedcomUid: gedcomUid ?? null, importStatus: 'confirmed' });
            gedcomToDbId.set(rec.id, existing.id);
            counts.date++;
            continue;
        }
    }

    // ── 3. Match by name + birth year (medium confidence) ────────────────────
    if (birthYear) {
        const candidates = findPersonsByNameAndBirthYear(fullName, birthYear);
        if (candidates.length === 1) {
            updatePerson(candidates[0].id, { ...fields, gedcomUid: gedcomUid ?? null, importStatus: 'needs_review' });
            gedcomToDbId.set(rec.id, candidates[0].id);
            counts.year++;
            needsReview.push({ name: fullName, reason: `name + birth year ${birthYear} matched one person` });
            continue;
        }
    }

    // ── 4. No match — insert new ──────────────────────────────────────────────
    const person = createPerson(fullName, {
        ...fields,
        gedcomId: rec.id,
        gedcomUid: gedcomUid ?? undefined,
        importStatus: 'new',
    });
    gedcomToDbId.set(rec.id, person.id);
    counts.created++;
}

if (!dryRun) {
    console.log(
        `Persons: ${counts.uid} matched by UID, ${counts.date} by name+date, ` +
        `${counts.year} by name+year (needs_review), ${counts.created} new`,
    );
    if (needsReview.length > 0) {
        console.log(`\n⚠  ${needsReview.length} person(s) need review in the admin UI:`);
        for (const r of needsReview) console.log(`   • ${r.name} — ${r.reason}`);
    }
}

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

    if (husbDbId && wifeDbId) {
        try {
            addRelationship(husbDbId, wifeDbId, 'spouse-of');
            relsCreated += 2;
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes('UNIQUE')) relsSkipped++;
            else throw err;
        }
    }

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

if (!dryRun) {
    console.log(`Relationships: ${relsCreated} created, ${relsSkipped} skipped (already exist)`);
}
console.log('Done.');

// Re-export for programmatic use
export { confirmPersonImport };
