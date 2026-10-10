import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// DATABASE_URL connects as a role that bypasses RLS — every query must apply
// its own visibility rules (see queries.ts). On Vercel use the Supabase
// transaction pooler (port 6543), which doesn't support prepared statements.
const globalForDb = globalThis as { pgClient?: postgres.Sql };

// Reuse across dev HMR reloads instead of leaking a pool per edit.
const client = (globalForDb.pgClient ??= postgres(process.env.DATABASE_URL!, {
  prepare: false,
}));

export const db = drizzle({ client });
