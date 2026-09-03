-- ============================================================================
-- Digital Heroes — Migration: 0003_storage_winner_proofs
--
-- PRD §09 "Winner Verification System" requires subscribers to be able to
-- upload a screenshot of their scores as proof. The `winners.proof_url`
-- column already existed in 0001, but no storage bucket backed it and no
-- UI wrote to it — this migration adds the bucket + RLS; the upload UI
-- lives in app/dashboard/proof-upload.tsx.
--
-- Folder convention: objects are stored at `<user_id>/<winner_id>-<filename>`
-- so a subscriber's own-row RLS check (auth.uid() = the first path segment)
-- can be enforced without a DB lookup on every storage call.
--
-- Run this AFTER 0001_init_schema.sql and 0002_storage_charity_images.sql,
-- against the same project.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('winner-proofs', 'winner-proofs', false)
on conflict (id) do nothing;

-- Private bucket: a subscriber can read/write only objects under their own
-- user_id folder; admins (who review every submission in /admin/winners)
-- can read everything. Nobody else can read a winner's proof screenshot.

create policy "winner_proofs_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'winner-proofs'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

create policy "winner_proofs_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'winner-proofs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "winner_proofs_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'winner-proofs'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

create policy "winner_proofs_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'winner-proofs' and public.is_admin());
