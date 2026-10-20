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
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
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

const createdAt = () =>
  timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow();

// All four are owned by the set_audit_fields trigger (see custom migration):
// client-supplied values are overwritten, so they can't be spoofed via the API.
// *_by is null for service-role writes (KML import, dashboard).
const audit = {
  created_at: createdAt(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  created_by: uuid('created_by').references(() => authUsers.id, {
    onDelete: 'set null',
  }),
  updated_by: uuid('updated_by').references(() => authUsers.id, {
    onDelete: 'set null',
  }),
};

// Signed in != editor: OAuth lets anyone with a Google/GitHub account create a
// session. Write access and PII require a row in `editors`.
const isEditor = sql`exists (select 1 from public.editors where user_id = ${authUid})`;

const editorWritePolicies = (table: string) => [
  pgPolicy(`${table}_select_editor`, {
    for: 'select',
    to: authenticatedRole,
    using: isEditor,
  }),
  pgPolicy(`${table}_insert_editor`, {
    for: 'insert',
    to: authenticatedRole,
    withCheck: isEditor,
  }),
  pgPolicy(`${table}_update_editor`, {
    for: 'update',
    to: authenticatedRole,
    using: isEditor,
    withCheck: isEditor,
  }),
];

const editorDeletePolicy = (table: string) =>
  pgPolicy(`${table}_delete_editor`, {
    for: 'delete',
    to: authenticatedRole,
    using: isEditor,
  });

export const editors = pgTable.withRLS(
  'editors',
  {
    user_id: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    created_at: createdAt(),
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

// Only `published` is public. New rows default to `draft` so nothing goes
// live by accident. `archived` replaces hard deletes.
export const locationStatus = pgEnum('location_status', [
  'draft',
  'published',
  'archived',
]);

export const locations = pgTable.withRLS(
  'locations',
  {
    id: ksuidPk(),
    name: text('name').notNull(),
    category: locationCategory('category').notNull(),
    status: locationStatus('status').notNull().default('draft'),
    lat: numeric('lat', { precision: 10, scale: 7, mode: 'number' }),
    lng: numeric('lng', { precision: 10, scale: 7, mode: 'number' }),
    address: text('address'),
    ward: smallint('ward'),
    website: text('website'),
    notes: text('notes'),
    // Object path inside the `location-images` bucket, not a URL.
    image_path: text('image_path'),
    ...audit,
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
    check(
      'locations_image_path_relative',
      sql`${t.image_path} !~ '^(/|[a-z]+://)'`,
    ),

    pgPolicy('locations_select_public', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`${t.status} = 'published'`,
    }),
    ...editorWritePolicies('locations'),
    // No delete policy: set status = 'archived' instead.
  ],
);

// Open hours for markets/farm stands. One row per weekday per season; a
// market open Wed + Sat has two rows. Times are Cleveland local time.
export const marketSchedules = pgTable.withRLS(
  'market_schedules',
  {
    id: ksuidPk(),
    location_id: text('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    // 0 = Sunday … 6 = Saturday, matching JS getDay() and Postgres dow.
    day_of_week: smallint('day_of_week').notNull(),
    opens_at: time('opens_at').notNull(),
    closes_at: time('closes_at').notNull(),
    // Both null = year-round.
    season_start: date('season_start', { mode: 'string' }),
    season_end: date('season_end', { mode: 'string' }),
    notes: text('notes'),
    ...audit,
  },
  (t) => [
    index('market_schedules_location_id_idx').on(t.location_id),
    check(
      'market_schedules_day_of_week_range',
      sql`${t.day_of_week} between 0 and 6`,
    ),
    check('market_schedules_hours_order', sql`${t.closes_at} > ${t.opens_at}`),
    check(
      'market_schedules_season_paired',
      sql`(${t.season_start} is null) = (${t.season_end} is null)`,
    ),
    check(
      'market_schedules_season_order',
      sql`${t.season_end} >= ${t.season_start}`,
    ),

    // Visible exactly when the parent location is (RLS on locations applies
    // inside the subquery).
    pgPolicy('market_schedules_select_public', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`exists (select 1 from public.locations l where l.id = ${t.location_id})`,
    }),
    ...editorWritePolicies('market_schedules'),
    editorDeletePolicy('market_schedules'),
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
    ...audit,
  },
  (t) => [
    // Same person manages several sites in the source data; dedupe on email.
    unique('contacts_email_key').on(t.email),
    ...editorWritePolicies('contacts'),
    editorDeletePolicy('contacts'),
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
    created_at: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.location_id, t.contact_id] }),
    index('location_contacts_contact_id_idx').on(t.contact_id),
    ...editorWritePolicies('location_contacts'),
    editorDeletePolicy('location_contacts'),
  ],
);
