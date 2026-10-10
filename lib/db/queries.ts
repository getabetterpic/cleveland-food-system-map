import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { cacheLife } from 'next/cache';
import { db } from './index';
import { locations, marketSchedules } from './schema';

// Supabase serves public buckets at a fixed URL; no client needed.
function locationImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/location-images/${path}`;
}

/** Public map data: published locations + schedules, no audit or PII columns. */
export async function getPublishedLocations() {
  'use cache';
  cacheLife('minutes');

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
