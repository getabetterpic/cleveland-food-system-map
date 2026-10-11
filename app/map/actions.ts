'use server';

import { eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { asUser } from '@/lib/db';
import { LOCATIONS_TAG } from '@/lib/db/queries';
import { locations } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { LOCATION_IMAGES_BUCKET } from '@/src/lib/location-images';

/**
 * Points a location at a photo the editor just uploaded to Storage — or at
 * nothing, with `path = null` — then deletes the photo it replaces.
 * Editor-only: enforced by RLS (asUser) here and by the storage.objects
 * policies on upload/delete.
 */
export async function setLocationImage(
  locationId: string,
  path: string | null,
): Promise<{ error: string } | undefined> {
  // Only accept the shape PhotoUpload produces: `<location id>/<uuid>.jpg`.
  if (
    typeof locationId !== 'string' ||
    !/^[0-9A-Za-z]{27}$/.test(locationId) ||
    (path !== null &&
      (typeof path !== 'string' ||
        !new RegExp(`^${locationId}/[0-9a-f-]{36}\\.jpg$`).test(path)))
  ) {
    return { error: 'Invalid photo' };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return { error: 'Sign in to change photos' };

  const previous = await asUser(data.claims, async (tx) => {
    const [current] = await tx
      .select({ image_path: locations.image_path })
      .from(locations)
      .where(eq(locations.id, locationId));
    // RLS: non-editors match no rows to update.
    const updated = await tx
      .update(locations)
      .set({ image_path: path })
      .where(eq(locations.id, locationId))
      .returning({ id: locations.id });
    return updated.length ? { path: current?.image_path ?? null } : null;
  });
  if (!previous) return { error: 'Only editors can change photos' };

  if (previous.path && previous.path !== path) {
    // Best effort: a leftover object costs storage, not correctness.
    const { error } = await supabase.storage
      .from(LOCATION_IMAGES_BUCKET)
      .remove([previous.path]);
    if (error) console.error('Failed to delete old location image', error);
  }

  updateTag(LOCATIONS_TAG);
}
