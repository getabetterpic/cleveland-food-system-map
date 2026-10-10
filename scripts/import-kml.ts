/**
 * scripts/import-kml.ts — KML import tool for Cleveland Food System Map
 *
 * Usage:
 *   npm run import-kml -- [--dry-run] [--verbose] [--file path/to/file.kml]
 *
 * Writes through Drizzle over DATABASE_URL (from .env.local). That connection
 * bypasses RLS, so this is trusted tooling only; created_by/updated_by stay null.
 *
 * Idempotent: locations upsert on (name, lat, lng), contacts on email, links
 * are insert-or-ignore. The whole import runs in one transaction.
 * Re-imports never touch `status` or `image_path` on existing locations, so
 * editor archiving and uploaded images survive.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as xml2js from 'xml2js';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  contacts,
  locationContacts,
  locations,
  type locationCategory,
} from '../lib/db/schema.ts';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const ENV_FILE = path.resolve(import.meta.dirname, '../.env.local');
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const DATABASE_URL = process.env.DATABASE_URL ?? '';

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const fileArg =
  args.indexOf('--file') !== -1 ? args[args.indexOf('--file') + 1] : undefined;
const KML_FILE =
  fileArg ?? path.resolve(process.cwd(), 'scripts/cleveland-food-map.kml');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = (typeof locationCategory.enumValues)[number];

interface ContactRecord {
  name: string | null;
  phone: string | null;
  email: string | null;
}

interface LocationRecord {
  name: string;
  category: Category;
  lat: number | null;
  lng: number | null;
  address: string | null;
  ward: number | null;
  website: string | null;
  notes: string | null;
}

interface ParsedPlacemark {
  location: LocationRecord;
  contacts: ContactRecord[];
}

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

const STYLE_MAP: Array<[string, Category]> = [
  ['icon-1582-0F9D58', 'garden'],
  ['icon-1566-A52714', 'farm'],
  ['icon-1578-9C27B0', 'market'],
];

function categoryFromStyleUrl(styleUrl: string | undefined): Category | null {
  if (!styleUrl) return null;
  for (const [substring, category] of STYLE_MAP) {
    if (styleUrl.includes(substring)) return category;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Description parsing
//
// Descriptions are <br>-separated lines, mostly "Label: value". Contact lines
// (manager / email / phone) become contacts and are kept OUT of notes — notes
// are public, contacts are not. Everything unrecognized goes to notes.
// ---------------------------------------------------------------------------

// Matches:
//   (216) 555-1234  216-555-1234  216.555.1234  2165551234  2165551234ext.,2705
// Normalized to 10 digits, plus " x<ext>" when present.
const PHONE_RE =
  /\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})(?:\s*(?:ext|x)[.,\s]*(\d+))?/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_RE_LOOSE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function normalizePhone(text: string): string | null {
  const m = text.match(PHONE_RE);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}${m[4] ? ` x${m[4]}` : ''}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type LineKind = 'name' | 'email' | 'phone' | 'website' | 'address' | 'skip';

// Label → field. "Garden Manger" and "Phone Number" are real typos/variants in the source.
function classifyLabel(label: string): LineKind | null {
  const l = label.toLowerCase();
  if (/manag|manger|director|contact/.test(l)) return 'name';
  if (l === 'email') return 'email';
  if (/phone|number/.test(l)) return 'phone';
  if (l === 'website') return 'website';
  if (l === 'farm address') return 'address';
  // Ward comes from ExtendedData; neighborhood is not stored.
  if (l === 'ward' || l === 'neighborhood') return 'skip';
  return null;
}

function parseDescription(html: string) {
  const people: ContactRecord[] = [];
  const notes: string[] = [];
  let website: string | null = null;
  let address: string | null = null;

  // A new contact starts at each name line, or when the current contact
  // already has the field being set (e.g. a second "Email:" line).
  const current = (field?: 'phone' | 'email'): ContactRecord => {
    const last = people.at(-1);
    if (last && (!field || last[field] === null)) return last;
    const fresh: ContactRecord = { name: null, phone: null, email: null };
    people.push(fresh);
    return fresh;
  };

  // Split on <br>, and also before an inline "Phone:"/"Email:" that shares a
  // line with the manager name ("Terra Thomas Phone: ...").
  const lines = html.split(/<br\s*\/?>|(?=\b(?:Phone|Email)\s*:)/i);
  for (const raw of lines) {
    const line = stripHtml(raw);
    if (!line) continue;

    const labeled = line.match(/^([A-Za-z /]+?)\s*:\s*(.*)$/);
    const kind = labeled ? classifyLabel(labeled[1]!) : null;
    const value = labeled ? labeled[2]!.trim() : line;

    if (kind === 'name' && EMAIL_RE.test(value)) {
      // "Contact: someone@example.org"
      current('email').email = value.toLowerCase();
    } else if (kind === 'name') {
      people.push({ name: value || null, phone: null, email: null });
    } else if (kind === 'email') {
      current('email').email = value.toLowerCase() || null;
    } else if (kind === 'phone' || (!kind && /^[\d\s().-]{10,}$/.test(line))) {
      current('phone').phone = normalizePhone(value) ?? value;
    } else if (kind === 'website') {
      website = value || null;
    } else if (kind === 'address') {
      address = value || null;
    } else if (kind !== 'skip') {
      notes.push(line);
    }
  }

  return {
    contacts: people.filter((c) => c.name || c.phone || c.email),
    notes: notes.join('\n') || null,
    website,
    address,
  };
}

// ---------------------------------------------------------------------------
// Address cleanup — strip trailing neighborhood suffix
// e.g. "1234 Main St, Cleveland, OH 44105 Glenville" → "1234 Main St, Cleveland, OH 44105"
// Strategy: if there is a 5-digit ZIP, keep everything up to and including it.
// ---------------------------------------------------------------------------

function cleanAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const zipMatch = raw.match(/\d{5}/);
  if (zipMatch && zipMatch.index !== undefined) {
    return raw.slice(0, zipMatch.index + 5).trim();
  }
  return raw.trim() || null;
}

// ---------------------------------------------------------------------------
// Cleveland bounding box
// ---------------------------------------------------------------------------

const CLE_LAT_MIN = 41.35;
const CLE_LAT_MAX = 41.6;
const CLE_LNG_MIN = -82.0;
const CLE_LNG_MAX = -81.45;

function outsideCleveland(lat: number, lng: number): boolean {
  return (
    lat < CLE_LAT_MIN ||
    lat > CLE_LAT_MAX ||
    lng < CLE_LNG_MIN ||
    lng > CLE_LNG_MAX
  );
}

// ---------------------------------------------------------------------------
// KML parsing
// ---------------------------------------------------------------------------

// xml2js produces deeply nested arrays; these helpers dereference safely.
function first<T>(val: T | T[] | undefined): T | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}

function attr(node: Record<string, unknown>, name: string): string | undefined {
  const attrs = node['$'] as Record<string, string> | undefined;
  return attrs?.[name];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XmlNode = Record<string, any>;

function extendedData(placemark: XmlNode, name: string): string | undefined {
  const extData = first(placemark['ExtendedData']) as XmlNode | undefined;
  const dataNodes: XmlNode[] = Array.isArray(extData?.['Data'])
    ? extData['Data']
    : [];
  const node = dataNodes.find((d) => attr(d, 'name') === name);
  return node ? (first(node['value']) as string | undefined) : undefined;
}

function parsePlacemark(
  placemark: XmlNode,
): { record: ParsedPlacemark; warnings: string[] } | { error: string } {
  const warnings: string[] = [];

  const name = (first(placemark['name']) as string | undefined)?.trim() ?? '';
  const styleUrl = first(placemark['styleUrl']) as string | undefined;
  const rawCoords = first(first(placemark['Point'])?.['coordinates']) as
    string | undefined;
  const rawAddress = first(placemark['address']) as string | undefined;
  const descHtml =
    (first(placemark['description']) as string | undefined) ?? '';

  // --- Coordinates ---
  let lat: number | null = null;
  let lng: number | null = null;
  if (!rawCoords) {
    warnings.push(
      `"${name}": missing <coordinates> — will be imported with null lat/lng`,
    );
  } else {
    const parts = rawCoords.trim().split(',');
    const parsedLng = parseFloat(parts[0] ?? '');
    const parsedLat = parseFloat(parts[1] ?? '');
    if (!isFinite(parsedLat) || !isFinite(parsedLng)) {
      warnings.push(
        `"${name}": invalid coordinates "${rawCoords}" — will be imported with null lat/lng`,
      );
    } else {
      lat = parsedLat;
      lng = parsedLng;
    }
  }

  // --- Category ---
  const category = categoryFromStyleUrl(styleUrl);
  if (!category)
    return {
      error: `"${name}": unrecognized styleUrl "${styleUrl ?? ''}"`,
    };

  // --- Ward ---
  let ward: number | null = null;
  const rawWard = extendedData(placemark, 'Ward');
  if (rawWard) {
    ward = parseInt(rawWard, 10); // parseInt ignores trailing decimals
    if (isNaN(ward)) ward = null;
  }

  // --- Description ---
  const desc = parseDescription(descHtml);
  const website = extendedData(placemark, 'Website')?.trim() || desc.website;
  const address = cleanAddress(rawAddress ?? desc.address);

  // --- Warnings ---
  if (desc.contacts.length === 0) warnings.push(`"${name}": no contact info`);
  for (const c of desc.contacts) {
    if (c.email && !EMAIL_RE.test(c.email))
      warnings.push(`"${name}": malformed email "${c.email}"`);
    if (c.phone && !/^\d{10}( x\d+)?$/.test(c.phone))
      warnings.push(`"${name}": malformed phone "${c.phone}"`);
  }
  if (
    desc.notes &&
    (EMAIL_RE_LOOSE.test(desc.notes) || PHONE_RE.test(desc.notes))
  )
    warnings.push(
      `"${name}": notes look like they contain contact info (public!)`,
    );
  if (ward !== null && (ward < 1 || ward > 17))
    warnings.push(`"${name}": ward ${ward} out of range (1–17)`);
  if (lat !== null && lng !== null && outsideCleveland(lat, lng))
    warnings.push(
      `"${name}": coordinates (${lat}, ${lng}) outside Cleveland bounding box`,
    );

  return {
    record: {
      location: {
        name,
        category,
        lat,
        lng,
        address,
        ward,
        website,
        notes: desc.notes,
      },
      contacts: desc.contacts,
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Database writes
// ---------------------------------------------------------------------------

interface WriteCounts {
  inserted: number;
  updated: number;
  contactsCreated: number;
  linksCreated: number;
}

type Db = ReturnType<typeof drizzle>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// Returns the contact id, creating the contact if needed. Email is the dedupe
// key; email-less contacts are matched on (name, phone).
async function upsertContact(
  tx: Tx,
  c: ContactRecord,
): Promise<{ id: string; created: boolean }> {
  if (c.email) {
    const [row] = await tx
      .insert(contacts)
      .values(c)
      .onConflictDoUpdate({
        target: contacts.email,
        set: {
          name: sql`coalesce(excluded.name, ${contacts.name})`,
          phone: sql`coalesce(excluded.phone, ${contacts.phone})`,
        },
      })
      .returning({ id: contacts.id, created: sql<boolean>`xmax = 0` });
    return row!;
  }

  const [existing] = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        isNull(contacts.email),
        sql`${contacts.name} is not distinct from ${c.name}`,
        sql`${contacts.phone} is not distinct from ${c.phone}`,
      ),
    )
    .limit(1);
  if (existing) return { id: existing.id, created: false };

  const [row] = await tx
    .insert(contacts)
    .values(c)
    .returning({ id: contacts.id });
  return { id: row!.id, created: true };
}

async function writeRecords(
  db: Db,
  records: ParsedPlacemark[],
): Promise<WriteCounts> {
  const counts: WriteCounts = {
    inserted: 0,
    updated: 0,
    contactsCreated: 0,
    linksCreated: 0,
  };

  await db.transaction(async (tx) => {
    for (const { location, contacts: people } of records) {
      // status is only set on insert, so re-imports don't republish archived rows.
      const [loc] = await tx
        .insert(locations)
        .values({ ...location, status: 'published' })
        .onConflictDoUpdate({
          target: [locations.name, locations.lat, locations.lng],
          set: {
            category: sql`excluded.category`,
            address: sql`excluded.address`,
            ward: sql`excluded.ward`,
            website: sql`excluded.website`,
            notes: sql`excluded.notes`,
          },
        })
        .returning({ id: locations.id, inserted: sql<boolean>`xmax = 0` });
      if (loc!.inserted) counts.inserted++;
      else counts.updated++;

      for (const person of people) {
        const contact = await upsertContact(tx, person);
        if (contact.created) counts.contactsCreated++;
        const linked = await tx
          .insert(locationContacts)
          .values({ location_id: loc!.id, contact_id: contact.id })
          .onConflictDoNothing()
          .returning({ id: locationContacts.contact_id });
        counts.linksCreated += linked.length;
      }
    }
  });

  return counts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // --- Read file ---
  if (!fs.existsSync(KML_FILE)) {
    console.error(`File not found: ${KML_FILE}`);
    process.exit(1);
  }
  const kmlText = fs.readFileSync(KML_FILE, 'utf-8');

  // --- Parse XML ---
  const parsed = await xml2js.parseStringPromise(kmlText, {
    explicitArray: true,
  });

  const folders: XmlNode[] = [];
  const doc = parsed?.['kml']?.['Document']?.[0] ?? parsed?.['kml'];
  const topFolders: XmlNode[] = doc?.['Folder'] ?? [];
  // Flatten nested folders
  function collectFolders(nodes: XmlNode[]) {
    for (const f of nodes) {
      folders.push(f);
      if (f['Folder']) collectFolders(f['Folder'] as XmlNode[]);
    }
  }
  collectFolders(topFolders);

  const allPlacemarks: XmlNode[] = folders.flatMap(
    (f) => (f['Placemark'] as XmlNode[] | undefined) ?? [],
  );

  // Also pick up top-level placemarks outside any folder
  const topPlacemarks: XmlNode[] = doc?.['Placemark'] ?? [];
  allPlacemarks.push(...topPlacemarks);

  // --- Parse placemarks ---
  const records: ParsedPlacemark[] = [];
  const allWarnings: string[] = [];
  const allErrors: string[] = [];

  for (const pm of allPlacemarks) {
    const result = parsePlacemark(pm);
    if ('error' in result) {
      allErrors.push(result.error);
    } else {
      records.push(result.record);
      allWarnings.push(...result.warnings);
    }
  }

  // --- Validation: duplicate names within file ---
  const nameCounts = new Map<string, number>();
  for (const r of records) {
    nameCounts.set(r.location.name, (nameCounts.get(r.location.name) ?? 0) + 1);
  }
  for (const [name, count] of nameCounts) {
    if (count > 1)
      allWarnings.push(
        `"${name}": duplicate name appears ${count} times in file`,
      );
  }

  if (VERBOSE) printVerboseTable(records);

  // Records with critical errors are skipped; records with only warnings
  // still proceed.
  let counts: WriteCounts | null = null;
  if (!DRY_RUN) {
    if (!DATABASE_URL) {
      console.error('DATABASE_URL not set in .env.local');
      process.exit(1);
    }
    const client = postgres(DATABASE_URL, { max: 1 });
    try {
      counts = await writeRecords(drizzle({ client }), records);
    } finally {
      await client.end();
    }
  }

  printSummary(
    allPlacemarks.length,
    records,
    counts,
    allErrors.length,
    allWarnings,
    allErrors,
  );
}

function printVerboseTable(records: ParsedPlacemark[]) {
  const COL = {
    name: 40,
    cat: 8,
    lat: 11,
    lng: 12,
    ward: 5,
    contacts: 50,
  };
  const pad = (s: string | number | null, w: number) =>
    String(s ?? '')
      .slice(0, w)
      .padEnd(w);

  const header =
    pad('Name', COL.name) +
    '  ' +
    pad('Cat', COL.cat) +
    '  ' +
    pad('Lat', COL.lat) +
    '  ' +
    pad('Lng', COL.lng) +
    '  ' +
    pad('Ward', COL.ward) +
    '  ' +
    pad('Contacts', COL.contacts);
  const divider = '-'.repeat(header.length);

  console.log('\n' + header);
  console.log(divider);

  for (const { location: r, contacts: people } of records) {
    const contactSummary = people
      .map((c) => [c.name, c.phone, c.email].filter(Boolean).join(' / '))
      .join('; ');
    console.log(
      pad(r.name, COL.name) +
        '  ' +
        pad(r.category, COL.cat) +
        '  ' +
        pad(r.lat?.toFixed(5) ?? 'null', COL.lat) +
        '  ' +
        pad(r.lng?.toFixed(5) ?? 'null', COL.lng) +
        '  ' +
        pad(r.ward, COL.ward) +
        '  ' +
        pad(contactSummary, COL.contacts),
    );
  }
  console.log(divider);
}

function printSummary(
  placemarks: number,
  records: ParsedPlacemark[],
  counts: WriteCounts | null,
  skipped: number,
  warnings: string[],
  errors: string[],
) {
  const contactCount = records.reduce((n, r) => n + r.contacts.length, 0);
  console.log(`\n--- Import Summary${counts ? '' : ' (dry run)'} ---`);
  console.log(`Placemarks found:  ${placemarks}`);
  console.log(`Parsed valid:      ${records.length}`);
  console.log(`Contacts parsed:   ${contactCount}`);
  console.log(`Skipped:           ${skipped}`);
  if (counts) {
    console.log(`Inserted:          ${counts.inserted}`);
    console.log(`Updated:           ${counts.updated}`);
    console.log(`Contacts created:  ${counts.contactsCreated}`);
    console.log(`Links created:     ${counts.linksCreated}`);
  }

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors) console.log(`  ✗ ${e}`);
  }

  console.log('');
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
