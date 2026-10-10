import type { locationCategory } from '@/lib/db/schema';
import type { getPublishedLocations } from '@/lib/db/queries';

export type Category = (typeof locationCategory.enumValues)[number];

/** A location as the public map receives it (see getPublishedLocations). */
export type Location = Awaited<
  ReturnType<typeof getPublishedLocations>
>[number];
export type MarketSchedule = Location['schedules'][number];
