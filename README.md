# Digital Heroes — Golf Charity Platform

A subscription platform combining golf score tracking, monthly draw-based
rewards, and charity fundraising. Built for the Digital Heroes full-stack
trainee selection assignment (PRD v1.0, March 2026) with Next.js 14,
Supabase (Postgres + Auth + Storage), and Stripe.

This README covers the entire app — public site, subscriber dashboard,
admin panel, database, and deployment — as a single deliverable.

---

## 1. Test credentials

Run `npm run seed` once against a provisioned Supabase project (see §5),
then log in at `/login` with any of:

| Role       | Email                            | Password             |
| ---------- | --------------------------------- | --------------------- |
| Admin      | `admin@digitalheroes.test`       | `DigitalHeroes2026!` |
| Subscriber | `subscriber1@digitalheroes.test` | `DigitalHeroes2026!` |
| Subscriber | `subscriber2@digitalheroes.test` | `DigitalHeroes2026!` |
| Subscriber | `subscriber3@digitalheroes.test` | `DigitalHeroes2026!` |

Subscriber accounts are seeded with sample scores (3–5 each, so one
exercises the "fewer than 5" edge case) and an active subscription. The
seed script is idempotent — re-running it won't duplicate users, scores,
or subscriptions.

---

## 2. What the PRD asked for, and where it lives

| PRD section | Implementation |
| --- | --- |
| §04 Subscription & Payment | Stripe Checkout (`/subscribe`, `app/api/subscribe`), lifecycle sync via webhook (`app/api/webhooks/stripe`), real-time active-subscription check on every gated request (`lib/subscription.ts`) |
| §05 Score Management | `app/dashboard` + `app/api/scores` — 1–45 range, one score per date, edit via re-submit, **delete** via `DELETE /api/scores?id=`, 5-score rolling limit enforced by a DB trigger (`0001_init_schema.sql`) |
| §06/§07 Draw & Reward | `app/api/draws/run` — random and algorithmic (`favor_rare`/`favor_common`) draws, server-owned simulation snapshots, exact-preview publishing, integer-cent prize allocation, prize pool split **40/35/25** across 5/4/3-match tiers, jackpot rollover on the 5-match tier only |
| §08 Charity System | `/charities` directory + detail pages, 10% minimum contribution (enforced by a DB check constraint), independent `donations` table, and an immutable paid-Stripe-invoice charity contribution ledger |
| §09 Winner Verification | `app/dashboard/proof-upload.tsx` (subscriber uploads proof to a private Storage bucket) + `app/admin/winners` (approve/reject, mark paid) |
| §10 User Dashboard | `app/dashboard` — subscription status, score entry/edit/delete, selected charity + contribution %, **participation summary** (draws entered + next draw date), **winnings overview** (total won, per-win payment status) |
| §11 Admin Dashboard | `app/admin/*` — users, draws, charities, winners, reports |
| §12 UI/UX | Homepage leads with impact, not golf; `framer-motion` transitions throughout |
| §13 Technical | Mobile-first Tailwind layouts, JWT/session auth via Supabase, HTTPS on Vercel, **email notifications** via `lib/email.ts` (Resend) for subscription confirmation, draw results, and winner alerts |
| §14 Scalability | See §4 below |
| §15 Deliverables | See §5–6 below |

---

## 3. What's simplified vs. full spec, and why

Flagged here per the brief, since ambiguity-resolution is scored under
"Problem-Solving":

- **Algorithmic draw weighting direction.** The PRD says algorithmic
  draws are "weighted by most/least frequent user scores" but not which
  direction. Both directions (`favor_rare` / `favor_common`) are
  implemented (`app/api/draws/run/route.ts`), defaulting to `favor_rare`,
  exposed as a dropdown in `/admin/draws` when "Algorithmic" is selected.
- **Email is real but provider-optional.** `lib/email.ts` sends through
  Resend's HTTP API. Without `RESEND_API_KEY` set, every send no-ops with
  a console log instead of throwing — so the app builds and runs without
  a paid provider configured, but the exact same code path sends real
  mail once the key is added. This was previously an open gap; it's now
  wired into signup (welcome), the Stripe webhook (subscription
  confirmed), draw publish (results + winner alerts), and winner
  verification/payout status changes.
- **Winner proof updates are DB-guarded.** Migration `0004` prevents a subscriber from changing prize, payment, or approval data; they can only update their own proof while the verification state remains pending. Admin transitions remain available.
- **Charity contribution accounting is invoice-backed.** `invoice.paid` /
  `invoice.payment_succeeded` webhooks write one immutable ledger row per
  Stripe invoice (idempotent by invoice ID). Reports and the member dashboard
  show recorded money separately from the contribution percentage setting.
- **Subscription override is manual-only, deliberately narrow.**
  `/admin/users/[id]` lets an admin set `plan`/`status` directly but never
  touches `stripe_customer_id`, `stripe_subscription_id`, or
  `current_period_end` — so a later real Stripe webhook event still
  reconciles correctly instead of fighting a stale manual edit.
- **Participation summary's "upcoming draws" is computed, not stored.**
  There's no separate "scheduled draws" table (draws only exist once
  simulated/published), so the dashboard shows the first day of next
  calendar month as "Next draw" rather than an admin-editable schedule.
- **No column-level split between "add a charity" and "feature a
  charity" permissions.** Both actions require `is_admin()`; the brief
  didn't ask for finer-grained admin roles, so none was invented.

---

## 4. Scalability considerations (PRD §14)

- **Multi-country:** no currency/locale is hardcoded outside the `$`
  prefix in a handful of display strings and the Stripe price IDs
  (already region-configurable per Stripe product). Adding a `currency`
  column to `subscriptions` and formatting via `Intl.NumberFormat` would
  be the next step.
- **Teams / corporate accounts:** `profiles.role` is a simple enum today;
  extending to a `team_id` + role-per-team model is additive — the
  existing `is_admin()` RLS pattern generalizes to a `is_team_admin(team_id)`
  function without touching other tables.
- **Campaign module:** `charities` and `donations` are already independent
  of the draw engine, so a future "campaign" concept (e.g. time-boxed
  fundraising pushes) could reference `charity_id` the same way
  `subscriptions` and `donations` do now.
- **Mobile app:** all business logic lives in `app/api/*` Route Handlers
  and DB-level RLS/triggers, not in page components — a React Native or
  Flutter client could call the same `/api/scores`, `/api/subscribe`,
  and `/api/draws/run` endpoints (plus Supabase Auth directly) without
  duplicating logic.

---

## 5. Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Stripe values (see §6)
npm run seed                  # creates the test accounts in §1
npm run dev
```

Visit `http://localhost:3000`.

Storage buckets used by the app (`charity-images`, `winner-proofs`) are
created and hardened by the numbered migrations in `supabase/migrations/` —
run all six, in order, against your Supabase project before `npm run seed`.

---

## 6. Deployment

See `DEPLOYMENT_CHECKLIST.md` for the full step-by-step, including every
required and optional environment variable. Summary: deploy to a **new**
Vercel project, wired to a **new** Supabase project's env vars, Stripe
test-mode keys, and (optionally) a Resend API key for real email
delivery.

---

## 7. Smoke-test coverage (PRD §16)

Final acceptance checklist (run against the target environment before submission):

- Signup → subscribe (Stripe Checkout, test card) → webhook activates
  the subscription → dashboard reflects it, welcome + confirmation
  emails fire
- Score entry — 5-score rolling logic enforced by the DB trigger,
  1–45 range validated client- and DB-side, duplicate-date insert is an
  upsert (edit), delete removes a single entry, both blocked with a
  clear 403 while the subscription isn't active
- Draw simulation vs. publish — simulate creates a short-lived server-owned review snapshot; publish is
  disabled until a simulation has succeeded, requires explicit confirmation,
  and publishes the exact subscribers, scores, numbers and prize allocation
  shown in that preview; only one draw can be published per calendar month;
  prize money is allocated in integer cents and the 5-match-only rollover is
  carried from the latest earlier published draw
- Charity CRUD — create/edit/delete/feature-toggle, image upload
- Winner verification flow — subscriber uploads proof from their
  dashboard (private Storage bucket, RLS-scoped to owner or admin) →
  admin approves/rejects → payment status blocked from `paid` unless
  `verification_status = approved` → payout/verification emails fire
- Admin-only route gating — `requireAdmin()` redirects a non-admin
  session to `/login?error=not_authorized`, a signed-out session to
  `/login`; re-checked independently inside every Server Action
- Responsive down to mobile — sidebar nav collapses via Tailwind's
  default breakpoints, all tables scroll rather than overflow the
  viewport
- Error handling — every Server Action returns `{ error }` rather than
  throwing to an unhandled promise rejection; API routes return
  structured JSON errors with appropriate status codes

**Not smoke-tested in a sandboxed build environment** (needs a live
Supabase project and Stripe/Resend keys): the actual `/api/draws/run`
call end-to-end, real image/proof upload round-trips, Stripe-driven
subscription status changes, and real email delivery. Also verify the Stripe Billing Portal is enabled and test a real cancellation/renewal. See
`DEPLOYMENT_CHECKLIST.md` §5 for how to verify all of these post-deploy.
