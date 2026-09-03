-- ============================================================================
-- 0006_final_financial_and_draw_hardening
-- Closes the remaining end-to-end gaps found during acceptance testing:
--   * durable, idempotent charity contribution accounting
--   * server-owned simulation snapshots so publish exactly matches preview
--   * database-level winner state-machine protection
--   * one published draw per calendar month
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. ACTUAL SUBSCRIPTION CHARITY CONTRIBUTIONS
-- -----------------------------------------------------------------------------
-- A contribution is a financial fact and must be tied to the Stripe invoice
-- that generated it. The unique invoice id makes webhook redelivery idempotent.
create table if not exists public.subscription_charity_contributions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  charity_id        uuid not null references public.charities (id),
  subscription_id   uuid references public.subscriptions (id) on delete set null,
  stripe_invoice_id text not null unique,
  currency          text not null default 'usd',
  gross_amount      numeric not null check (gross_amount >= 0),
  contribution_pct  numeric not null check (contribution_pct >= 10 and contribution_pct <= 100),
  amount            numeric not null check (amount >= 0),
  created_at        timestamptz not null default now()
);

create index if not exists idx_subscription_charity_contributions_charity_id
  on public.subscription_charity_contributions (charity_id);
create index if not exists idx_subscription_charity_contributions_user_id
  on public.subscription_charity_contributions (user_id);

alter table public.subscription_charity_contributions enable row level security;

create policy "subscription_charity_contributions_select_own_or_admin"
  on public.subscription_charity_contributions
  for select using (user_id = auth.uid() or public.is_admin());

create policy "subscription_charity_contributions_write_admin_only"
  on public.subscription_charity_contributions
  for insert with check (public.is_admin());

-- Service-role webhook writes bypass RLS. No browser update/delete policy is
-- intentionally provided because an accounting ledger must be immutable.

-- -----------------------------------------------------------------------------
-- 2. SERVER-OWNED DRAW SIMULATION SNAPSHOTS
-- -----------------------------------------------------------------------------
-- Simulations are transient review artifacts, not published draws. Persisting
-- the exact computed snapshot server-side prevents a changed score/subscription
-- from making Publish silently differ from the preview.
create table if not exists public.draw_simulations (
  id                uuid primary key default gen_random_uuid(),
  month             date not null,
  draw_type         text not null check (draw_type in ('random', 'algorithmic')),
  algorithm_weighting text check (algorithm_weighting in ('favor_rare', 'favor_common')),
  snapshot          jsonb not null,
  created_by        uuid not null references public.profiles (id) on delete cascade,
  expires_at        timestamptz not null,
  published_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_draw_simulations_expires_at
  on public.draw_simulations (expires_at);

alter table public.draw_simulations enable row level security;

create policy "draw_simulations_admin_only"
  on public.draw_simulations
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. ONE DRAW PER CALENDAR MONTH
-- -----------------------------------------------------------------------------
-- The product is a monthly draw. Prevent two separate random/algorithmic draws
-- for the same month. Route validation also enforces this before insertion.
create unique index if not exists draws_one_per_month_idx
  on public.draws (month);

-- -----------------------------------------------------------------------------
-- 4. WINNER STATE MACHINE
-- -----------------------------------------------------------------------------
create or replace function public.guard_winner_state_machine()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Backend/service-role inserts are trusted. On update, enforce the business
  -- invariants for every actor, including admins.
  if tg_op = 'UPDATE' then
    if new.verification_status = 'approved' and new.proof_url is null then
      raise exception 'Proof is required before a winner can be approved';
    end if;

    if new.payment_status = 'paid' and new.verification_status <> 'approved' then
      raise exception 'Only approved winners can be marked paid';
    end if;

    if new.verification_status = 'rejected' and new.payment_status = 'paid' then
      raise exception 'A rejected winner cannot remain paid';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_winner_state_machine on public.winners;
create trigger trg_guard_winner_state_machine
  before update on public.winners
  for each row execute procedure public.guard_winner_state_machine();

-- -----------------------------------------------------------------------------
-- 5. SCORES CANNOT BE FUTURE-DATED
-- -----------------------------------------------------------------------------
create or replace function public.guard_score_date_not_future()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.score_date > current_date then
    raise exception 'Score date cannot be in the future';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_score_date_not_future on public.scores;
create trigger trg_guard_score_date_not_future
  before insert or update on public.scores
  for each row execute procedure public.guard_score_date_not_future();

-- Tighten the existing subscriber proof guard so an approved claim cannot be
-- reset to pending by bypassing the UI and calling Supabase directly.
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

  if old.verification_status = 'approved' then
    raise exception 'Approved proof records are locked';
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

-- -----------------------------------------------------------------------------
-- 6. CHECKOUT LOCKS TO PREVENT DUPLICATE PAID SUBSCRIPTIONS
-- -----------------------------------------------------------------------------
create table if not exists public.subscription_checkout_locks (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  stripe_session_id text unique,
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now()
);

alter table public.subscription_checkout_locks enable row level security;
create policy "subscription_checkout_locks_admin_only"
  on public.subscription_checkout_locks
  for all using (public.is_admin()) with check (public.is_admin());
