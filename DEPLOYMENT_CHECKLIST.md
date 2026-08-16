# Deployment Checklist — Digital Heroes

Full-stack deliverable per PRD §15: public site, subscriber dashboard,
admin panel, database, and source code, all in one Next.js app deployed
to a **new** Vercel project against a **new** Supabase project.

## 1. Supabase project

- [ ] Create a **new** Supabase project (not personal/existing — PRD §15
      deployment constraint).
- [ ] Run the migrations **in order**, via `supabase db push` or pasted
      directly into the SQL Editor:
      1. `supabase/migrations/0001_init_schema.sql` — core schema, RLS,
         triggers (score limit, one-per-date).
      2. `supabase/migrations/0002_storage_charity_images.sql` — public
         bucket for charity images (admin charity CRUD).
      3. `supabase/migrations/0003_storage_winner_proofs.sql` — private
         bucket for winner proof-of-score uploads (PRD §09).
- [ ] In **Storage → Policies**, confirm `charity-images` (4 policies) and
      `winner-proofs` (4 policies) both exist. If the migrations ran
      cleanly this is automatic — this step is just a visual confirmation
      before trusting the upload flows.

## 2. Vercel project

- [ ] Create a **new** Vercel project (not personal/existing — same PRD
      constraint applies to hosting as to Supabase).
- [ ] Connect the repo, framework preset: Next.js (see `vercel.json`).
- [ ] Set the **Environment Variables** below (Project Settings →
      Environment Variables → apply to Production, Preview, and
      Development):

  | Variable | Source | Required? |
  |---|---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Yes |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | Yes |
  | `SUPABASE_SERVICE_ROLE_KEY` | same — mark **Sensitive**, server-only | Yes |
  | `STRIPE_SECRET_KEY` | Stripe Dashboard, test mode | Yes |
  | `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks, after step 3 below | Yes |
  | `STRIPE_PRICE_ID_MONTHLY` | Stripe Dashboard → Products (create if missing) | Yes |
  | `STRIPE_PRICE_ID_YEARLY` | same | Yes |
  | `NEXT_PUBLIC_APP_URL` | the Vercel deployment URL, e.g. `https://<project>.vercel.app` | Yes |
  | `RESEND_API_KEY` | resend.com dashboard → API Keys | No — without it, emails log to console instead of sending (see `lib/email.ts`) |
  | `RESEND_FROM_EMAIL` | a verified sender in Resend, e.g. `Digital Heroes <noreply@yourdomain.com>` | No — defaults to Resend's shared test sender |

- [ ] Deploy.

## 3. Stripe webhook

- [ ] Stripe Dashboard → Developers → Webhooks → Add endpoint:
      `https://<your-vercel-domain>/api/webhooks/stripe`
- [ ] Select events: `checkout.session.completed`,
      `customer.subscription.updated`, `customer.subscription.deleted`.
- [ ] Copy the signing secret into `STRIPE_WEBHOOK_SECRET` on Vercel and
      redeploy.

## 4. Promote an admin account

- [ ] Run `npm run seed` locally with `.env.local` pointed at the **live**
      project (not localhost) — this creates `admin@digitalheroes.test`
      already set to `role = 'admin'`, plus 3 seeded subscriber accounts.
- [ ] Alternatively, sign up normally through `/signup` with your own
      email, then in the Supabase SQL Editor:
      ```sql
      update public.profiles set role = 'admin' where email = 'you@example.com';
      ```

## 5. Post-deploy smoke test (in order)

- [ ] `/` loads, homepage renders featured charities.
- [ ] `/signup` → `/subscribe` → Stripe Checkout (test card
      `4242 4242 4242 4242`) → redirected to `/dashboard?subscribed=1`
      with an **active** subscription shown.
- [ ] Welcome email and subscription-confirmation email both arrive (or,
      if `RESEND_API_KEY` isn't set, both are visible in the Vercel
      function logs as `[email:noop]` lines).
- [ ] `/dashboard` → add a score → appears immediately; add a 6th score →
      only the 5 most recent remain; delete a score → it's gone.
- [ ] Try submitting a score while the subscription is **not** active
      (e.g. cancel it first) → blocked with a clear message, both in the
      UI and from `POST /api/scores` directly (403).
- [ ] `/login` with admin credentials → lands on `/admin/users`.
- [ ] A non-admin account (or signed-out) hitting `/admin/users` redirects
      correctly (`/login` if signed out, `/login?error=not_authorized` if
      signed in but not admin).
- [ ] `/admin/charities` → add a charity with an image → image renders in
      the public `/charities` directory.
- [ ] `/admin/draws` → Simulate with a real month → verify the returned
      pool split is 40/35/25 across 5/4/3-match tiers (PRD §07).
- [ ] `/admin/draws` → Publish → row appears in `/draws` (public) and in
      each entered subscriber's dashboard participation list; re-running
      the same month/type shows "already published" instead of erroring.
- [ ] Draw-published and winner-alert emails arrive for entrants/winners
      (or log as `[email:noop]` without a configured provider).
- [ ] If you were a winner in that draw: `/dashboard` → upload a proof
      screenshot → appears in `/admin/winners` for that user.
- [ ] `/admin/winners` → approve → mark paid → status updates immediately,
      and the subscriber's dashboard reflects the new payment status.
- [ ] `/admin/reports` → figures are non-zero if seed/test data is present.

## 6. Known, documented simplifications

See `README.md` §"What's simplified vs. full spec, and why" for the
deliberate trade-offs (algorithmic weighting direction, charity
percentage reporting, subscription override scope, etc.) — those are
flagged there rather than repeated here.

No automated test suite was added (out of scope for a trainee-assignment
timeline); the smoke test above is manual, mirroring PRD §16's own
checklist format. No CI/CD beyond Vercel's default git-push deploys.
