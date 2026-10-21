# Cleveland Food System Map

Public map of Cleveland's community gardens, urban farms, and farmers markets, with a small
editor UI for the nonprofit's 2–5 authorized editors. Replaces a Google My Maps implementation.

Live at [clevelandfoodsystem.land](https://clevelandfoodsystem.land).

## Features

- Public map at `/map` (`/` redirects there): category-colored pins, category filter with counts,
  text search, location detail panel (mobile sheet / desktop sidebar), directions
- Find my location + nearest location
- Editor sign-in via Supabase Auth: email/password and GitHub OAuth (magic link + Google planned, #26)
- Editors see contact info and can add, replace, or remove a location's photo

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind + shadcn/ui
- react-leaflet + OpenStreetMap (client-only)
- Supabase: Postgres, Auth, Storage (`location-images` bucket)
- Drizzle ORM for schema, migrations, and server-side reads/writes
- Hosted on Vercel

## Local development

1. `npm install`
2. `cp .env.example .env.local` and fill in:

   | Var                                    | Where                                                    |
   | -------------------------------------- | -------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → API                        |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API (publishable or anon)  |
   | `DATABASE_URL`                         | Supabase → Connect → Session pooler (server-only secret) |

3. `npm run db:migrate` to apply migrations in `drizzle/`
4. `npm run dev` → [localhost:3000](http://localhost:3000)

## Scripts

| Command               | Does                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`         | Dev server (Turbopack)                                                                             |
| `npm run build`       | Production build                                                                                   |
| `npm run lint`        | ESLint                                                                                             |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts`                                                       |
| `npm run db:migrate`  | Apply pending migrations                                                                           |
| `npm run import-kml`  | Upsert locations from `scripts/cleveland-food-map.kml` (`--dry-run`, `--verbose`, `--file <path>`) |

`import-kml` connects over `DATABASE_URL`, bypassing RLS — trusted tooling only.

## Layout

```
app/map/          Public map: server page (Drizzle) → MapClient, server actions
app/auth/         Auth routes + OAuth callback
lib/db/           Drizzle schema, client, queries
lib/supabase/     Supabase SSR clients + session proxy (default-deny allowlist)
proxy.ts          Next 16 proxy (formerly middleware)
src/              Map components, hooks, shared types (pre-Next code, still in use)
drizzle/          SQL migrations, incl. functions/triggers/grants Drizzle can't express
scripts/          KML import
```

## Data & access

- Tables: `locations`, `market_schedules`, `contacts`, `location_contacts`, `editors`
- Public sees only `status = 'published'` locations; nothing is hard-deleted (archive instead)
- Editors are rows in `editors`, added in the Supabase dashboard — there is no public sign-up.
  Signing in does not make you an editor.
- Contacts are PII and only returned to editors

See [`CLAUDE.md`](CLAUDE.md) for conventions and [`dev-decisions.md`](dev-decisions.md) for the why.
