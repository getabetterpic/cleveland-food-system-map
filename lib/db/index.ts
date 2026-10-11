import 'server-only';
import { sql } from 'drizzle-orm';
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` in a transaction as a signed-in Supabase user, so RLS applies and
 * auth.uid() resolves (the audit trigger records who wrote). Use for every
 * user-initiated write. `claims` must come from a verified
 * `supabase.auth.getClaims()`, never from client input.
 */
export function asUser<T>(
  claims: { sub: string },
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`,
    );
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}
