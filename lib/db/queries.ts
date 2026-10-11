import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { LOCATION_IMAGES_BUCKET } from '@/src/lib/location-images';
import { db } from './index';
import {
  contacts,
  editors,
  locationContacts,
  locations,
  marketSchedules,
} from './schema';

// Supabase serves public buckets at a fixed URL; no client needed.
function locationImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOCATION_IMAGES_BUCKET}/${path}`;
}

/** Expire with updateTag() after any write that changes the public map. */
export const LOCATIONS_TAG = 'locations';

/** Public map data: published locations + schedules, no audit or PII columns. */
export async function getPublishedLocations() {
  'use cache';
  cacheLife('minutes');
  cacheTag(LOCATIONS_TAG);

  const published = eq(locations.status, 'published');

  const [rows, schedules] = await Promise.all([
    db
      .select({
        id: locations.id,
        name: locations.name,
        category: locations.category,
        lat: locations.lat,
        lng: locations.lng,
        address: locations.address,
        website: locations.website,
        notes: locations.notes,
        image_path: locations.image_path,
      })
      .from(locations)
      .where(published)
      .orderBy(asc(locations.name)),
    db
      .select({
        id: marketSchedules.id,
        location_id: marketSchedules.location_id,
        day_of_week: marketSchedules.day_of_week,
        opens_at: marketSchedules.opens_at,
        closes_at: marketSchedules.closes_at,
        season_start: marketSchedules.season_start,
        season_end: marketSchedules.season_end,
        notes: marketSchedules.notes,
      })
      .from(marketSchedules)
      .innerJoin(locations, eq(marketSchedules.location_id, locations.id))
      .where(published)
      .orderBy(asc(marketSchedules.day_of_week), asc(marketSchedules.opens_at)),
  ]);

  return rows.map(({ image_path, ...loc }) => ({
    ...loc,
    image_url: image_path ? locationImageUrl(image_path) : null,
    schedules: schedules.filter((s) => s.location_id === loc.id),
  }));
}

/**
 * Whether the request comes from an editor. Reads the session cookie: never
 * call inside 'use cache'. Deduped per request.
 */
export const isEditor = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return false;

  const [editor] = await db
    .select({ user_id: editors.user_id })
    .from(editors)
    .where(eq(editors.user_id, userId));
  return Boolean(editor);
});

/**
 * Manager contacts for published locations, keyed by location id — or null
 * unless the request comes from an editor. Mirrors the contacts RLS policy,
 * but `db` bypasses RLS, so this editor check is the only thing keeping PII
 * off the page.
 */
export async function getEditorContacts() {
  if (!(await isEditor())) return null;

  const rows = await db
    .select({
      location_id: locationContacts.location_id,
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(locationContacts)
    .innerJoin(contacts, eq(locationContacts.contact_id, contacts.id))
    .innerJoin(
      locations,
      and(
        eq(locationContacts.location_id, locations.id),
        eq(locations.status, 'published'),
      ),
    )
    .orderBy(asc(contacts.name));

  const byLocation: Record<
    string,
    Omit<(typeof rows)[number], 'location_id'>[]
  > = {};
  for (const { location_id, ...contact } of rows) {
    (byLocation[location_id] ??= []).push(contact);
  }
  return byLocation;
}
