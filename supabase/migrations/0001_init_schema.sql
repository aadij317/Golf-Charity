-- ============================================================================
-- Digital Heroes — Golf Charity Subscription Platform
-- Migration: 0001_init_schema
-- Scope: Backend/Database/Core Logic workstream ONLY
--
-- This migration creates the locked schema, enforces business rules at the
-- database level (score limits, uniqueness, ranges), and applies Row Level
-- Security so that:
--   - subscribers can only read/write their own rows
--   - admins (role='admin' in profiles) can read/write everything
--
-- Run this against a NEW Supabase project via:
--   supabase db push
-- or paste directly into the Supabase SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. PROFILES  (extends auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text not null,
  role        text not null default 'subscriber' check (role in ('subscriber', 'admin')),
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
-- SECURITY DEFINER lets this trigger bypass RLS to perform the insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper used by every RLS policy below. SECURITY DEFINER + a fixed
-- search_path avoids infinite recursion when profiles' own RLS policy also
-- calls is_admin(), and avoids search_path hijacking.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. CHARITIES
-- ----------------------------------------------------------------------------
create table public.charities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  image_url    text,
  is_featured  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles (id) on delete cascade,
  plan                      text not null check (plan in ('monthly', 'yearly')),
  status                    text not null default 'lapsed' check (status in ('active', 'cancelled', 'lapsed')),
  stripe_customer_id        text,
  stripe_subscription_id    text unique,
  current_period_end        timestamptz,
  charity_id                uuid references public.charities (id),
  charity_contribution_pct  numeric not null default 10 check (charity_contribution_pct >= 10 and charity_contribution_pct <= 100),
  created_at                timestamptz not null default now()
);

create index idx_subscriptions_user_id on public.subscriptions (user_id);
create index idx_subscriptions_status on public.subscriptions (status);

-- ----------------------------------------------------------------------------
-- 4. SCORES
-- Business rule: only the latest 5 scores are retained per user; a new score
-- replaces the oldest automatically. One score per user per date.
-- ----------------------------------------------------------------------------
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  score       int not null check (score >= 1 and score <= 45),
  score_date  date not null,
  created_at  timestamptz not null default now(),
  unique (user_id, score_date)
);

create index idx_scores_user_id on public.scores (user_id);

-- Enforce "only last 5 kept per user" at the DB layer so this rule holds
-- regardless of which client/service inserts the row.
create or replace function public.enforce_score_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.scores
  where id in (
    select id from public.scores
    where user_id = new.user_id
    order by score_date desc, created_at desc
    offset 5
  );
  return new;
end;
$$;

create trigger trg_enforce_score_limit
  after insert on public.scores
  for each row execute procedure public.enforce_score_limit();

-- ----------------------------------------------------------------------------
-- 5. DRAWS
-- ----------------------------------------------------------------------------
create table public.draws (
  id                       uuid primary key default gen_random_uuid(),
  month                    date not null,
  status                   text not null default 'draft' check (status in ('draft', 'simulated', 'published')),
  draw_type                text not null check (draw_type in ('random', 'algorithmic')),
  winning_numbers          int[] not null default '{}',
  jackpot_rollover_amount  numeric not null default 0,
  created_at               timestamptz not null default now(),
  published_at             timestamptz,
  unique (month, draw_type)
);

-- ----------------------------------------------------------------------------
-- 6. DRAW ENTRIES
-- ----------------------------------------------------------------------------
create table public.draw_entries (
  id            uuid primary key default gen_random_uuid(),
  draw_id       uuid not null references public.draws (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  matched_tier  text check (matched_tier in ('5', '4', '3')),
  created_at    timestamptz not null default now(),
  unique (draw_id, user_id)
);

create index idx_draw_entries_draw_id on public.draw_entries (draw_id);
create index idx_draw_entries_user_id on public.draw_entries (user_id);

-- ----------------------------------------------------------------------------
-- 7. WINNERS
-- ----------------------------------------------------------------------------
create table public.winners (
  id                   uuid primary key default gen_random_uuid(),
  draw_id              uuid not null references public.draws (id) on delete cascade,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  tier                 text not null check (tier in ('5', '4', '3')),
  prize_amount         numeric not null,
  proof_url            text,
  verification_status  text not null default 'pending' check (verification_status in ('pending', 'approved', 'rejected')),
  payment_status       text not null default 'pending' check (payment_status in ('pending', 'paid')),
  created_at           timestamptz not null default now()
);

create index idx_winners_draw_id on public.winners (draw_id);
create index idx_winners_user_id on public.winners (user_id);

-- ----------------------------------------------------------------------------
-- 8. DONATIONS  (independent of gameplay)
-- ----------------------------------------------------------------------------
create table public.donations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  charity_id  uuid not null references public.charities (id),
  amount      numeric not null check (amount > 0),
  created_at  timestamptz not null default now()
);

create index idx_donations_user_id on public.donations (user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Pattern for every table: subscriber can touch only rows where user_id
-- (or id, for profiles) = auth.uid(); admins can touch everything.
-- ============================================================================

alter table public.profiles     enable row level security;
alter table public.charities    enable row level security;
alter table public.subscriptions enable row level security;
alter table public.scores       enable row level security;
alter table public.draws        enable row level security;
alter table public.draw_entries enable row level security;
alter table public.winners      enable row level security;
alter table public.donations    enable row level security;

-- ---- profiles ----
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- inserts happen via the handle_new_user trigger (security definer) or the
-- service role; no direct client insert policy is needed.

-- ---- charities ----
-- Public directory: anyone (including anon visitors) can browse charities.
create policy "charities_select_public" on public.charities
  for select using (true);

create policy "charities_write_admin_only" on public.charities
  for insert with check (public.is_admin());
create policy "charities_update_admin_only" on public.charities
  for update using (public.is_admin());
create policy "charities_delete_admin_only" on public.charities
  for delete using (public.is_admin());

-- ---- subscriptions ----
create policy "subscriptions_select_own_or_admin" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

create policy "subscriptions_insert_own_or_admin" on public.subscriptions
  for insert with check (user_id = auth.uid() or public.is_admin());

create policy "subscriptions_update_own_or_admin" on public.subscriptions
  for update using (user_id = auth.uid() or public.is_admin());

create policy "subscriptions_delete_admin_only" on public.subscriptions
  for delete using (public.is_admin());

-- ---- scores ----
create policy "scores_select_own_or_admin" on public.scores
  for select using (user_id = auth.uid() or public.is_admin());

create policy "scores_insert_own_or_admin" on public.scores
  for insert with check (user_id = auth.uid() or public.is_admin());

create policy "scores_update_own_or_admin" on public.scores
  for update using (user_id = auth.uid() or public.is_admin());

create policy "scores_delete_own_or_admin" on public.scores
  for delete using (user_id = auth.uid() or public.is_admin());

-- ---- draws ----
-- Subscribers may see published draws; drafts/simulations are admin-only.
create policy "draws_select_published_or_admin" on public.draws
  for select using (status = 'published' or public.is_admin());

create policy "draws_write_admin_only" on public.draws
  for insert with check (public.is_admin());
create policy "draws_update_admin_only" on public.draws
  for update using (public.is_admin());
create policy "draws_delete_admin_only" on public.draws
  for delete using (public.is_admin());

-- ---- draw_entries ----
create policy "draw_entries_select_own_or_admin" on public.draw_entries
  for select using (user_id = auth.uid() or public.is_admin());

create policy "draw_entries_write_admin_only" on public.draw_entries
  for insert with check (public.is_admin());
create policy "draw_entries_update_admin_only" on public.draw_entries
  for update using (public.is_admin());
create policy "draw_entries_delete_admin_only" on public.draw_entries
  for delete using (public.is_admin());

-- ---- winners ----
create policy "winners_select_own_or_admin" on public.winners
  for select using (user_id = auth.uid() or public.is_admin());

-- Winner rows are created by the draw engine (admin/service role only).
create policy "winners_insert_admin_only" on public.winners
  for insert with check (public.is_admin());

-- Users need to be able to update THEIR OWN row to attach proof_url;
-- admins need to update verification_status/payment_status. Column-level
-- separation would need a Postgres GRANT/REVOKE per column or a dedicated
-- RPC (see README "Known trade-offs") — flagged as a follow-up, not built
-- here since it's outside this workstream's core deliverables.
create policy "winners_update_own_or_admin" on public.winners
  for update using (user_id = auth.uid() or public.is_admin());

create policy "winners_delete_admin_only" on public.winners
  for delete using (public.is_admin());

-- ---- donations ----
create policy "donations_select_own_or_admin" on public.donations
  for select using (user_id = auth.uid() or public.is_admin());

create policy "donations_insert_own_or_admin" on public.donations
  for insert with check (user_id = auth.uid() or public.is_admin());

create policy "donations_update_admin_only" on public.donations
  for update using (public.is_admin());

create policy "donations_delete_admin_only" on public.donations
  for delete using (public.is_admin());

-- ============================================================================
-- SEED (optional, safe to remove) — a couple of charities so the frontend
-- workstream has something to render immediately.
-- ============================================================================
insert into public.charities (name, description, is_featured) values
  ('First Tee Foundation', 'Introduces young people to golf and life skills.', true),
  ('Junior Golf Fund', 'Funds equipment and coaching for underprivileged juniors.', false);
