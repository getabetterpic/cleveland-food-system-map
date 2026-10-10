create trigger locations_set_audit_fields
  before insert or update on public.locations
  for each row execute function public.set_audit_fields();
--> statement-breakpoint
create trigger market_schedules_set_audit_fields
  before insert or update on public.market_schedules
  for each row execute function public.set_audit_fields();
--> statement-breakpoint
create trigger contacts_set_audit_fields
  before insert or update on public.contacts
  for each row execute function public.set_audit_fields();
--> statement-breakpoint
-- Defense in depth: RLS already denies anon, but don't grant it at all.
revoke all on public.contacts, public.location_contacts, public.editors from anon;
--> statement-breakpoint
-- Editors are added via the dashboard/service role, never by clients.
revoke insert, update, delete on public.editors from anon, authenticated;
