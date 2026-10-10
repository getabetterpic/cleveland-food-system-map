-- updated_at maintained in the DB so supabase-js, Drizzle, and dashboard edits all bump it.
create trigger locations_set_updated_at
  before update on public.locations
  for each row execute procedure extensions.moddatetime(updated_at);
--> statement-breakpoint
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute procedure extensions.moddatetime(updated_at);
--> statement-breakpoint
-- Defense in depth: RLS already denies anon, but don't grant it at all.
revoke all on public.contacts, public.location_contacts, public.editors from anon;
--> statement-breakpoint
-- Editors are added via the dashboard/service role, never by clients.
revoke insert, update, delete on public.editors from anon, authenticated;
