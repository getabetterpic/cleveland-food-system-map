## Cleveland Food System Map

### Stack
- React + Vite + TypeScript — TS from day one, no exceptions
- react-leaflet + OpenStreetMap — no API key, free forever
- Supabase — Postgres, Auth, Storage, RLS
- Vercel — hosting, CI/CD on push to main
- Namecheap → Cloudflare → Vercel

### Auth
- Magic link (primary) + Google OAuth + GitHub OAuth
- Supabase Auth handles all of it — no custom auth code
- Editor management via Supabase dashboard, not custom UI

### Data
- Discrete fields — no blobs. Schema in `lib/db/schema.ts` (Drizzle)
- Manager PII in separate `contacts` table, editor-only via RLS
- Soft delete via `status = 'archived'` — nothing hard deleted
- Single hero image per location stored in Supabase Storage
- KML import script is permanent tooling, not throwaway — runs at cutover

### Design
- Mobile first — full-screen map on mobile, sidebar layout on desktop
- Breakpoint: 768px
- White/grey/black base, #3a7d44 accent used sparingly
- Destructive actions dark-styled, never red
- No over-polished aesthetic

### Agents
- Code review agent on every PR via GitHub Actions + Claude API
- KML import validation agent — anomaly report before any import
- Geocoding assist (Phase 5+) via OpenStreetMap Nominatim

### Workflow
- dev branch for all feature work, PR to main
- PRs even solo — clean history
- CLAUDE.md in repo root — updated before every new phase
- Claude Code = hands. This chat = architect.
