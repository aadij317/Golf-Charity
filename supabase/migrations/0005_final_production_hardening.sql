-- ============================================================================
-- 0005_final_production_hardening
-- Final pre-deployment hardening pass.
-- ============================================================================

-- Keep auth-owned / security-sensitive profile fields immutable for ordinary
-- subscribers. Profile email is created from auth.users; letting a browser
-- client edit it would desynchronise notifications from the actual login
-- identity. Subscribers may still update their display name, while admins and
-- service-role backend work remain unrestricted.
create or replace function public.guard_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if old.id <> auth.uid() or new.id is distinct from old.id then
    raise exception 'Not allowed to change profile identity';
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only administrators may change profile roles';
  end if;

  if new.email is distinct from old.email then
    raise exception 'Email is managed by the authentication account';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'Profile creation time cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_unauthorized_profile_role_change on public.profiles;
drop trigger if exists trg_guard_profile_sensitive_fields on public.profiles;
create trigger trg_guard_profile_sensitive_fields
  before update on public.profiles
  for each row execute procedure public.guard_profile_sensitive_fields();

-- A subscriber may need to replace or cancel an upload that failed to attach
-- to a winner record. The previous policy only allowed admins to delete proof
-- files, so client-side orphan cleanup could never succeed for the owner.
drop policy if exists "winner_proofs_admin_delete" on storage.objects;
drop policy if exists "winner_proofs_owner_or_admin_delete" on storage.objects;
create policy "winner_proofs_owner_or_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'winner-proofs'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- The winner proof guard in 0004 intentionally permits only proof submission
-- by subscribers. Explicitly include the primary key in that immutable set so
-- a subscriber cannot rewrite a winner record's identity while passing RLS on
-- the original row.
create or replace function public.guard_winner_subscriber_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.user_id <> auth.uid() or old.user_id <> auth.uid() then
    raise exception 'Not allowed to update this winner';
  end if;

  if new.id is distinct from old.id
     or new.draw_id is distinct from old.draw_id
     or new.user_id is distinct from old.user_id
     or new.tier is distinct from old.tier
     or new.prize_amount is distinct from old.prize_amount
     or new.payment_status is distinct from old.payment_status
     or new.created_at is distinct from old.created_at then
    raise exception 'Subscribers may only submit proof';
  end if;

  if new.verification_status <> 'pending' then
    raise exception 'Subscribers cannot change verification status';
  end if;

  return new;
end;
$$;
