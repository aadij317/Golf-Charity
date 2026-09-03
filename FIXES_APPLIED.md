# Final hardening pass — fixes applied

This pass focused on concrete production and UX gaps visible in the current codebase.

## Authentication and navigation
- Site header is now auth-aware on every public page.
- Signed-in users no longer see **Sign in** or **Get started**.
- Signed-in users see their dashboard identity and a real sign-out control.
- Admin users get an Admin panel link.
- Mobile navigation now exposes the same core routes and sign-out flow.
- The dashboard now uses the shared authenticated site header.
- Homepage primary CTAs adapt for signed-in users instead of always sending them to signup.
- Supabase session refresh middleware now covers application navigations so auth-aware server-rendered UI does not depend on the old `/admin` + `/login`-only matcher.

## Dashboard and checkout UX
- Dashboard now shows a clear post-checkout confirmation state for `?subscribed=1`.
- Existing dashboard cards, score flow, participation history, charity impact, and winnings remain intact.

## Subscription and Stripe hardening
- `/api/subscribe` now blocks an already-active subscription and also uses a database-backed short-lived checkout lock, closing the concurrent-click race that could otherwise create two paid Stripe subscriptions before the first webhook arrives.
- Subscribers can open Stripe Billing Portal from the dashboard to manage cancellation and billing details without directly mutating subscription truth in the browser.
- Subscription webhook confirmation email failures are isolated from subscription persistence so an email-provider outage does not make Stripe retry an otherwise successful state change.
- Stripe subscription update/delete database errors are now checked instead of being silently ignored.

## Score API hardening
- Score dates now reject impossible calendar values and future dates, both in the API and at the database trigger layer.
- Direct score deletion is now subscription-gated as well, matching the UI and stated business rule instead of allowing a lapsed user to bypass the disabled delete control with a direct API call.

## Winner proof upload hardening
- Proof uploads now require an image MIME type.
- Proof images are capped at 10 MB.
- Winner updates are explicitly scoped to the authenticated owner ID in addition to database RLS.
- If the database update fails after Storage upload, the newly uploaded private file is removed to avoid orphaned proof objects.

## Signup robustness
- Signup now handles Supabase email-confirmation projects correctly.
- If account creation succeeds but no browser session is created yet, the user is shown an explicit "check your email" state rather than being redirected to a protected subscription page and immediately bounced to login.

## Important live checks before submission/deployment
Run these against the actual Supabase/Stripe project because they require live credentials:
1. Login as subscriber and verify all public headers hide Sign in/Get started.
2. Sign out from desktop and mobile header.
3. Complete Stripe test checkout and verify the subscription row is activated by webhook.
4. Attempt Subscribe again while active and verify duplicate checkout is blocked.
5. Try score create/delete after subscription cancellation and verify both return 403.
6. Upload an oversized/non-image winner proof and verify the UI rejects it.
7. Verify email-confirmation signup behavior if Supabase Confirm email is enabled.
8. Run `npm ci` and `npm run build` in the deployment environment before pushing.


## Final pre-GitHub audit additions
- Draw simulation now creates a short-lived server-owned snapshot containing the exact eligible subscribers, score matches, winning numbers, prize allocation and rollover. Publish consumes that snapshot, so data cannot silently change between preview and publish.
- Only one draw can be published per calendar month, and backfilling an older month after a later published draw is blocked to preserve rollover order.
- Prize pools and individual payouts are calculated in integer cents with deterministic remainder allocation, eliminating floating-point rounding drift.
- Draw month input is constrained to a calendar month and the backend accepts only `YYYY-MM-01`.
- Publish failures after creating a draw now clean up the draw and cascading entries/winners instead of leaving partial draw state. Duplicate-race errors map to the same 409 already shown in the UI.
- Stripe Checkout creation now uses a deterministic idempotency key to protect against double-click/network retry duplicate sessions.
- Final database migration `0005_final_production_hardening.sql` makes security-sensitive profile fields immutable to subscribers, fixes winner-proof orphan cleanup permissions, and makes winner primary keys immutable for subscriber updates.
- New migration `0006_final_financial_and_draw_hardening.sql` adds an immutable paid-invoice charity ledger, simulation snapshots, checkout locks, future-score protection and database-level winner state-machine checks.
- Admin charity image uploads now validate image MIME type and a 10 MB size limit.
- Charity detail CTAs now respect auth/subscription state instead of offering a redundant checkout to an already-active member.
