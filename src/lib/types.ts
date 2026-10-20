import type { locationCategory, locations } from '@/lib/db/schema';

export type Category = (typeof locationCategory.enumValues)[number];

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
