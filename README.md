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
- Anyone can create an account, but an account alone grants nothing beyond the public map —
  editor access is a row in `editors` (see below)
- Contacts are PII and only returned to editors

## Accounts & editors

Sign-up is open; editing is not.

1. **Create an account** — either:
   - `/auth/sign-up` (linked as "Sign up" in the nav and on the login page): email + password.
     Supabase emails a confirmation link that lands the user on `/map`; they sign in at
     `/auth/login` after confirming.
   - "Sign in with GitHub" on `/auth/login`: the first sign-in creates the account, via
     `/auth/callback`. No confirmation step.
2. **Grant editor access** — in the Supabase dashboard, copy the user's id from
   Authentication → Users and insert it as `user_id` in the `editors` table. Delete the row to
   revoke. There is no invite UI.

Until step 2, a signed-in user sees exactly what the public sees. Editor checks run on the server
(`isEditor()` in `lib/db/queries.ts`) and in RLS, so a non-editor session can't read contacts or
write anything.

Forgotten passwords: `/auth/forgot-password` emails a reset link to `/auth/update-password`.

See [`CLAUDE.md`](CLAUDE.md) for conventions and [`dev-decisions.md`](dev-decisions.md) for the why.
