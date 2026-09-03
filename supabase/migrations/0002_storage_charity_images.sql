-- ============================================================================
-- Digital Heroes — Admin workstream addition
-- Migration: 0002_storage_charity_images
--
-- Not part of the locked 0001 schema (that's the backend workstream's
-- contract). This is this workstream's own requirement — charity image
-- upload — so it's kept as a separate, clearly-attributed migration
-- rather than edited into 0001, to avoid merge conflicts with the
-- backend account's file.
--
-- Run this AFTER 0001_init_schema.sql, against the same project.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('charity-images', 'charity-images', true)
on conflict (id) do nothing;

-- Public read (charity images are shown on the public directory — out of
-- this workstream's scope to build, but the bucket still needs to serve
-- them once that page exists).
create policy "charity_images_public_read"
  on storage.objects for select
  using (bucket_id = 'charity-images');

-- Only admins can write. Reuses public.is_admin() from 0001 rather than
-- redefining the same check.
create policy "charity_images_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'charity-images' and public.is_admin());

create policy "charity_images_admin_update"
  on storage.objects for update
  using (bucket_id = 'charity-images' and public.is_admin());

create policy "charity_images_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'charity-images' and public.is_admin());
