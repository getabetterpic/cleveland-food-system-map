import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  // Supabase manages these; Drizzle should only diff public.
  schemaFilter: ['public'],
  entities: { roles: { provider: 'supabase' } },
  dbCredentials: { url: process.env.DATABASE_URL! },
});
