-- Hero photos for locations. The bucket was first created in the dashboard;
-- this makes it reproducible and pins its limits (5 MB, jpeg/png/webp).
-- Public bucket: anyone can GET /object/public/..., no select policy needed for that.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('location-images', 'location-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint
-- Editors upload straight from the browser (keeps files off Vercel's request
-- size limit). Upload needs insert; replacing a photo deletes the old object,
-- which Storage requires select + delete for. No update: paths are never reused.
create policy location_images_select_editor on storage.objects
  for select to authenticated
  using (bucket_id = 'location-images'
         and exists (select 1 from public.editors where user_id = (select auth.uid())));
--> statement-breakpoint
create policy location_images_insert_editor on storage.objects
  for insert to authenticated
  with check (bucket_id = 'location-images'
              and exists (select 1 from public.editors where user_id = (select auth.uid())));
--> statement-breakpoint
create policy location_images_delete_editor on storage.objects
  for delete to authenticated
  using (bucket_id = 'location-images'
         and exists (select 1 from public.editors where user_id = (select auth.uid())));
