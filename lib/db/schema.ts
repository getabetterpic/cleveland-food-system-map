/**
 * Database schema — source of truth for tables, constraints, and RLS policies.
 *
 * TS keys are snake_case on purpose: `$inferSelect` then matches the row shape
 * supabase-js (PostgREST) returns, so client types derive from this file.
 *
 * Generate migrations with `npm run db:generate`. Functions, triggers, and
 * grants that Drizzle can't express live in the custom migrations under drizzle/.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  anonRole,
  authenticatedRole,
  authUid,
  authUsers,
} from 'drizzle-orm/supabase';

// KSUID generated in Postgres (public.gen_ksuid, see custom migration) so
// inserts from supabase-js, Drizzle, and the dashboard all get one.
const ksuidPk = () =>
  text('id')
    .primaryKey()
    .default(sql`public.gen_ksuid()`);

// updated_at is maintained by a moddatetime trigger, not by app code.
const timestamps = {
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
};

// Signed in != editor: OAuth lets anyone with a Google/GitHub account create a
// session. Write access and PII require a row in `editors`.
const isEditor = sql`exists (select 1 from public.editors where user_id = ${authUid})`;

export const editors = pgTable.withRLS(
  'editors',
  {
    user_id: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    created_at: timestamps.created_at,
  },
  () => [
    // Read-own-row only; this is what lets `isEditor` resolve inside policies.
    // Rows are managed from the Supabase dashboard (service role bypasses RLS).
    pgPolicy('editors_select_self', {
      for: 'select',
      to: authenticatedRole,
      using: sql`user_id = ${authUid}`,
    }),
  ],
);

export const locationCategory = pgEnum('location_category', [
  'garden',
  'farm',
  'market',
]);

export const locations = pgTable.withRLS(
  'locations',
  {
    id: ksuidPk(),
    name: text('name').notNull(),
    category: locationCategory('category').notNull(),
    lat: numeric('lat', { precision: 10, scale: 7, mode: 'number' }),
    lng: numeric('lng', { precision: 10, scale: 7, mode: 'number' }),
    address: text('address'),
    ward: smallint('ward'),
    website: text('website'),
    notes: text('notes'),
    image_url: text('image_url'),
    archived: boolean('archived').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    // NULLS NOT DISTINCT so re-importing a market without coordinates
    // upserts instead of inserting a duplicate.
    unique('locations_name_lat_lng_key')
      .on(t.name, t.lat, t.lng)
      .nullsNotDistinct(),
    check('locations_lat_range', sql`${t.lat} between -90 and 90`),
    check('locations_lng_range', sql`${t.lng} between -180 and 180`),
    check(
      'locations_lat_lng_paired',
      sql`(${t.lat} is null) = (${t.lng} is null)`,
    ),
    check('locations_ward_positive', sql`${t.ward} > 0`),

    pgPolicy('locations_select_public', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`not ${t.archived}`,
    }),
    pgPolicy('locations_select_editor', {
      for: 'select',
      to: authenticatedRole,
      using: isEditor,
    }),
    pgPolicy('locations_insert_editor', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: isEditor,
    }),
    pgPolicy('locations_update_editor', {
      for: 'update',
      to: authenticatedRole,
      using: isEditor,
      withCheck: isEditor,
    }),
    // No delete policy: locations are archived, never hard deleted.
  ],
);

// Manager PII. No anon policy (and anon grants revoked) — invisible to the public.
export const contacts = pgTable.withRLS(
  'contacts',
  {
    id: ksuidPk(),
    name: text('name'),
    phone: text('phone'),
    email: text('email'),
    ...timestamps,
  },
  (t) => [
    // Same person manages several sites in the source data; dedupe on email.
    unique('contacts_email_key').on(t.email),
    pgPolicy('contacts_all_editor', {
      for: 'all',
      to: authenticatedRole,
      using: isEditor,
      withCheck: isEditor,
    }),
  ],
);

export const locationContacts = pgTable.withRLS(
  'location_contacts',
  {
    location_id: text('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    contact_id: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    created_at: timestamps.created_at,
  },
  (t) => [
    primaryKey({ columns: [t.location_id, t.contact_id] }),
    index('location_contacts_contact_id_idx').on(t.contact_id),
    pgPolicy('location_contacts_all_editor', {
      for: 'all',
      to: authenticatedRole,
      using: isEditor,
      withCheck: isEditor,
    }),
  ],
);
