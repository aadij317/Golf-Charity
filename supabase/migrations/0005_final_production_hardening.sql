-- ============================================================================
-- 0005_final_production_hardening
--
-- Final production hardening pass.
-- ============================================================================


-- ============================================================================
-- PROFILE SECURITY
-- ============================================================================
--
-- Keep authentication/security-sensitive fields immutable for ordinary
-- subscribers. Subscribers may still update their normal profile fields
-- (such as their display name), while admins and server/service-role work
-- remain unrestricted.
--

create or replace function public.guard_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server/service-role operations and admins are allowed.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- A subscriber may only update their own profile.
  if old.id <> auth.uid() or new.id is distinct from old.id then
    raise exception 'Not allowed to change profile identity';
  end if;

  -- Role is admin-controlled.
  if new.role is distinct from old.role then
    raise exception 'Only administrators may change profile roles';
  end if;

  -- Email is owned by the authentication account.
  if new.email is distinct from old.email then
    raise exception 'Email is managed by the authentication account';
  end if;

  -- Creation timestamp is immutable.
  if new.created_at is distinct from old.created_at then
    raise exception 'Profile creation time cannot be changed';
  end if;

  return new;
end;
$$;


-- Replace the older role-only trigger from 0004 with this consolidated guard.
drop trigger if exists trg_prevent_unauthorized_profile_role_change
on public.profiles;

drop trigger if exists trg_guard_profile_sensitive_fields
on public.profiles;


create trigger trg_guard_profile_sensitive_fields
before update on public.profiles
for each row
execute procedure public.guard_profile_sensitive_fields();


-- ============================================================================
-- WINNER PROOF STORAGE DELETE PERMISSIONS
-- ============================================================================
--
-- Objects use the folder convention:
-- <user_id>/<winner_id>-<filename>
--
-- Owners can delete their own proof files and admins can delete any proof.
--

drop policy if exists "winner_proofs_admin_delete"
on storage.objects;

drop policy if exists "winner_proofs_owner_or_admin_delete"
on storage.objects;


create policy "winner_proofs_owner_or_admin_delete"
on storage.objects
for delete
using (
  bucket_id = 'winner-proofs'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.is_admin()
  )
);


-- ============================================================================
-- WINNER RECORD HARDENING
-- ============================================================================
--
-- Subscribers may only submit/update their proof-related fields.
-- All identity, draw, tier, prize, verification and payment outcomes remain
-- admin/server controlled.
--

create or replace function public.guard_winner_subscriber_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server/service-role operations and admins are trusted.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- Subscriber may only update their own winner record.
  if new.user_id <> auth.uid()
     or old.user_id <> auth.uid() then
    raise exception 'Not allowed to update this winner';
  end if;

  -- Subscribers cannot change record identity, draw ownership,
  -- tier, prize, payment, or creation time.
  if new.id is distinct from old.id
     or new.draw_id is distinct from old.draw_id
     or new.user_id is distinct from old.user_id
     or new.tier is distinct from old.tier
     or new.prize_amount is distinct from old.prize_amount
     or new.payment_status is distinct from old.payment_status
     or new.created_at is distinct from old.created_at then
    raise exception 'Subscribers may only submit proof';
  end if;

  -- Subscribers cannot approve/reject/change verification.
  if new.verification_status <> 'pending' then
    raise exception 'Subscribers cannot change verification status';
  end if;

  return new;
end;
$$;