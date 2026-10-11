-- RLS decides which rows; GRANTs decide whether a role may touch the table at
-- all. Newer Supabase projects no longer auto-grant public tables to anon /
-- authenticated, so without these every policy is dead code and any policy
-- that reads `editors` (isEditor — including the storage.objects ones) fails
-- with "permission denied for table editors". Grants mirror schema.ts policies.
grant usage on schema public to anon, authenticated;
--> statement-breakpoint
-- Public map: published rows only (RLS).
grant select on public.locations, public.market_schedules to anon, authenticated;
--> statement-breakpoint
-- isEditor() reads the caller's own row (editors_select_self). Writes to
-- editors stay dashboard/service-role only.
grant select on public.editors to authenticated;
--> statement-breakpoint
-- Editors (RLS): read all, insert/update everything.
grant select, insert, update on
  public.locations, public.market_schedules, public.contacts, public.location_contacts
  to authenticated;
--> statement-breakpoint
-- Editors (RLS): delete schedules/contacts/links. No delete on locations —
-- archive instead.
grant delete on public.market_schedules, public.contacts, public.location_contacts
  to authenticated;
