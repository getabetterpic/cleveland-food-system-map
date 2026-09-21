/**
 * scripts/import-kml.ts — KML import tool for Cleveland Food System Map
 *
 * Usage:
 *   tsx scripts/import-kml.ts [--dry-run] [--verbose] [--file path/to/file.kml]
 *
 * Requires a unique constraint on locations(name, lat, lng) for upsert:
 *   ALTER TABLE locations ADD CONSTRAINT locations_name_lat_lng_key UNIQUE (name, lat, lng);
 *
 * Dependencies: xml2js, dotenv, @supabase/supabase-js
 *   npm install --save-dev xml2js @types/xml2js dotenv tsx
 */

import * as fs from 'fs';
import * as path from 'path';
import * as xml2js from 'xml2js';
import * as dotenv from 'dotenv';
import { config } from 'dotenv';
import { resolve } from 'path';
import { stringify } from 'csv-stringify';
import { pipeline } from 'stream/promises';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

config({ path: resolve(import.meta.dirname, '../.env.local') });

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const fileArgIndex = args.indexOf('--file');
const KML_FILE =
  fileArgIndex !== -1 && args[fileArgIndex + 1]
    ? args[fileArgIndex + 1]
    : path.resolve(process.cwd(), 'scripts/cleveland-food-map.kml');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = 'garden' | 'farm' | 'market';

interface LocationRecord {
  name: string;
  category: Category;
  lat: number | null;
  lng: number | null;
  address: string | null;
  ward: number | null;
  manager_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  image_url: null;
  archived: false;
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
// HTML helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractManagerName(html: string): string | null {
  const match = html.match(/(?:Garden Manager|Farm [Mm]anager):\s*([^\n<&]+)/);
  return match ? match[1].trim() || null : null;
}

// Matches:
//   (216) 555-1234  216-555-1234  216.555.1234  2165551234  2165551234ext.2705
// Captures the 10-digit number only; extensions are consumed but not returned.
function extractPhone(text: string): string | null {
  const match = text.match(
    /\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})(?:\s*(?:ext|x|ext\.)\s*\d+)?/i,
  );
  if (!match) return null;
  return `${match[1]}${match[2]}${match[3]}`;
}

function extractEmail(html: string): string | null {
  const match = html.match(/[^\s<>]+@[^\s<>]+\.[^\s<>]+/);
  return match ? match[0].trim() : null;
}

// ---------------------------------------------------------------------------
// Address cleanup — strip trailing neighborhood suffix
// e.g. "1234 Main St, Cleveland, OH 44105 Glenville" → "1234 Main St, Cleveland, OH 44105"
// Strategy: if there is a 5-digit ZIP, keep everything up to and including it.
// ---------------------------------------------------------------------------

function cleanAddress(raw: string | undefined): string | null {
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

function parsePlacemark(
  placemark: XmlNode,
): { record: LocationRecord; warnings: string[] } | { error: string } {
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
  const extData = first(placemark['ExtendedData']) as XmlNode | undefined;
  if (extData) {
    const dataNodes: XmlNode[] = Array.isArray(extData['Data'])
      ? extData['Data']
      : [];
    const wardNode = dataNodes.find((d) => attr(d, 'name') === 'Ward');
    if (wardNode) {
      const raw = first(wardNode['value']) as string | undefined;
      if (raw) {
        ward = parseInt(raw, 10); // parseInt ignores trailing decimals
        if (isNaN(ward)) ward = null;
      }
    }
  }

  // --- Notes / extracted fields ---
  const plainText = stripHtml(descHtml);
  const manager_name = extractManagerName(descHtml);
  const phone = extractPhone(plainText);
  const email = extractEmail(descHtml);
  const notes = plainText || null;
  const address = cleanAddress(rawAddress);

  // --- Warnings ---
  if (!email && !phone)
    warnings.push(`"${name}": missing both email and phone`);
  if (ward !== null && (ward < 1 || ward > 21))
    warnings.push(`"${name}": ward ${ward} out of range (1–21)`);
  if (lat !== null && lng !== null && outsideCleveland(lat, lng))
    warnings.push(
      `"${name}": coordinates (${lat}, ${lng}) outside Cleveland bounding box`,
    );

  const record: LocationRecord = {
    name,
    category,
    lat,
    lng,
    address,
    ward,
    manager_name,
    phone,
    email,
    notes,
    image_url: null,
    archived: false,
  };

  return { record, warnings };
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
  const records: LocationRecord[] = [];
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
    nameCounts.set(r.name, (nameCounts.get(r.name) ?? 0) + 1);
  }
  for (const [name, count] of nameCounts) {
    if (count > 1)
      allWarnings.push(
        `"${name}": duplicate name appears ${count} times in file`,
      );
  }

  const columns = [
    'name',
    'category',
    'lat',
    'lng',
    'address',
    'ward',
    'manager_name',
    'phone',
    'email',
    'notes',
    'image_url',
    'archived',
  ];
  await writeCSV(columns, records);
}

async function writeCSV(columns, data): Promise<void> {
  const stringifier = stringify({
    header: true,
    columns: columns,
    cast: {
      number: (value) => value?.toString(),
    },
  });
  const writeableStream = fs.createWriteStream('scripts/output.csv');
  await pipeline(
    async function* () {
      for (const row of data) {
        if (row.phone) {
          row.phone = `+1 ${row.phone}`;
        }
        yield row;
      }
    },
    stringifier,
    writeableStream,
  );
  return new Promise((resolve, reject) => {
    writeableStream.on('finish', resolve);
    writeableStream.on('error', reject);
  });
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
