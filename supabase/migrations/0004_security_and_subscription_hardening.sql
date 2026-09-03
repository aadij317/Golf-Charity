-- ============================================================================
-- 0004_security_and_subscription_hardening
--
-- Production security hardening:
-- 1) Subscribers cannot promote their own profile role
-- 2) Subscription state is admin/server owned, never client owned
-- 3) Subscribers can only update their own winner proof while verification
--    and payment outcomes remain admin/server controlled
-- ============================================================================


-- ============================================================================
-- ONE CURRENT SUBSCRIPTION RECORD PER USER
-- ============================================================================

create unique index if not exists subscriptions_one_per_user_idx
  on public.subscriptions (user_id);


-- ============================================================================
-- PREVENT UNAUTHORIZED PROFILE ROLE CHANGES
-- ============================================================================

create or replace function public.prevent_unauthorized_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server/service-role operations and admins are allowed.
  if auth.uid() is not null
     and old.role is distinct from new.role
     and not public.is_admin() then
    raise exception 'Only administrators may change profile roles';
  end if;

  return new;
end;
$$;


drop trigger if exists trg_prevent_unauthorized_profile_role_change
on public.profiles;


create trigger trg_prevent_unauthorized_profile_role_change
before update on public.profiles
for each row
execute procedure public.prevent_unauthorized_profile_role_change();


-- ============================================================================
-- SUBSCRIPTION INSERT/UPDATE HARDENING
-- ============================================================================

-- Remove old policies from earlier versions.
drop policy if exists "subscriptions_insert_own_or_admin"
on public.subscriptions;

drop policy if exists "subscriptions_update_own_or_admin"
on public.subscriptions;


-- Remove policies from a previous partial execution so this migration
-- can safely be re-run.
drop policy if exists "subscriptions_insert_admin_only"
on public.subscriptions;

drop policy if exists "subscriptions_update_admin_only"
on public.subscriptions;


-- Only admins can insert subscription records through authenticated database
-- access. Server/service-role operations bypass RLS.
create policy "subscriptions_insert_admin_only"
on public.subscriptions
for insert
with check (public.is_admin());


-- Only admins can update subscription records through authenticated database
-- access. Server/service-role operations bypass RLS.
create policy "subscriptions_update_admin_only"
on public.subscriptions
for update
using (public.is_admin())
with check (public.is_admin());


-- ============================================================================
-- WINNER UPDATE HARDENING
-- ============================================================================

create or replace function public.guard_winner_subscriber_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role/server writes have no auth.uid() and are trusted backend work.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- Subscriber must only update their own winner record.
  if new.user_id <> auth.uid()
     or old.user_id <> auth.uid() then
    raise exception 'Not allowed to update this winner';
  end if;

  -- Subscribers cannot alter draw ownership or financial outcomes.
  if new.draw_id is distinct from old.draw_id
     or new.user_id is distinct from old.user_id
     or new.tier is distinct from old.tier
     or new.prize_amount is distinct from old.prize_amount
     or new.payment_status is distinct from old.payment_status
     or new.created_at is distinct from old.created_at then

    raise exception 'Subscribers may only submit proof';
  end if;

  -- Subscribers cannot verify or reject their own winning status.
  if new.verification_status <> 'pending' then
    raise exception 'Subscribers cannot change verification status';
  end if;

  return new;
end;
$$;


drop trigger if exists trg_guard_winner_subscriber_update
on public.winners;


create trigger trg_guard_winner_subscriber_update
before update on public.winners
for each row
execute procedure public.guard_winner_subscriber_update();