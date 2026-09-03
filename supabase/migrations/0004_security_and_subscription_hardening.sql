-- ============================================================================
-- 0004_security_and_subscription_hardening
-- Closes two production-critical gaps from the initial trainee build:
--   1) a subscriber must never be able to promote their own profile role
--   2) subscription truth is Stripe/admin-owned, never client-owned
-- It also constrains winner updates so subscribers can submit proof without
-- changing verification/payment outcomes.
-- ============================================================================

-- One current subscription record per user keeps dashboard and draw accounting
-- deterministic. Run this on a fresh project before seeding, as documented.
create unique index if not exists subscriptions_one_per_user_idx
  on public.subscriptions (user_id);

-- Prevent self-promotion while preserving normal profile edits and admin tools.
create or replace function public.prevent_unauthorized_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and old.role is distinct from new.role and not public.is_admin() then
    raise exception 'Only administrators may change profile roles';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_unauthorized_profile_role_change on public.profiles;
create trigger trg_prevent_unauthorized_profile_role_change
  before update on public.profiles
  for each row execute procedure public.prevent_unauthorized_profile_role_change();

-- Subscription state is created/reconciled by Stripe webhooks (service role)
-- or explicitly managed by admins. Browser clients can only read their own row.
drop policy if exists "subscriptions_insert_own_or_admin" on public.subscriptions;
drop policy if exists "subscriptions_update_own_or_admin" on public.subscriptions;
create policy "subscriptions_insert_admin_only" on public.subscriptions
  for insert with check (public.is_admin());
create policy "subscriptions_update_admin_only" on public.subscriptions
  for update using (public.is_admin()) with check (public.is_admin());

-- Subscribers may only change their own proof path and may only leave their
-- verification state pending. Verification/payment transitions remain admin-only.
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

  if new.user_id <> auth.uid() or old.user_id <> auth.uid() then
    raise exception 'Not allowed to update this winner';
  end if;

  if new.draw_id is distinct from old.draw_id
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

drop trigger if exists trg_guard_winner_subscriber_update on public.winners;
create trigger trg_guard_winner_subscriber_update
  before update on public.winners
  for each row execute procedure public.guard_winner_subscriber_update();
