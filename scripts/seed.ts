/**
 * Seeds the NEW Supabase project with test credentials so an evaluator can
 * log in immediately without any manual setup, per the brief's "Seed
 * script" requirement.
 *
 * Creates:
 *   - 1 admin       (admin@digitalheroes.test / DigitalHeroes2026!)
 *   - 3 subscribers (subscriber1-3@digitalheroes.test / same password)
 *     with sample scores, an active subscription, and a charity pick
 *
 * Requires 0001_init_schema.sql (backend workstream) to have already been
 * run against the target project — this script only inserts rows, it does
 * not create tables.
 *
 * Run with: npm run seed
 * Needs .env.local populated with NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY (service role — this script bypasses RLS on
 * purpose, since it's creating the very first users).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SEED_PASSWORD = "DigitalHeroes2026!";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment. " +
      "Copy env.example to .env.local and fill in the new Supabase project's values first."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createUser(email: string, fullName: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    // Re-running the script shouldn't crash on already-seeded data —
    // look up the existing user instead so scores/subscriptions below
    // still get (re)attached.
    if (error.message.includes("already been registered")) {
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === email);
      if (existing) return existing.id;
    }
    throw error;
  }
  return data.user.id;
}

async function main() {
  console.log("Seeding Digital Heroes test data…\n");

  // --- Admin -----------------------------------------------------------
  const adminId = await createUser("admin@digitalheroes.test", "Admin User");
  await supabase.from("profiles").update({ role: "admin" }).eq("id", adminId);
  console.log("✓ Admin:      admin@digitalheroes.test /", SEED_PASSWORD);

  // --- Charities (in case 0001's seed block was stripped) --------------
  const { data: existingCharities } = await supabase.from("charities").select("id, name");
  let charities = existingCharities ?? [];
  if (charities.length === 0) {
    const { data: inserted } = await supabase
      .from("charities")
      .insert([
        { name: "First Tee Foundation", description: "Introduces young people to golf and life skills.", is_featured: true },
        { name: "Junior Golf Fund", description: "Funds equipment and coaching for underprivileged juniors.", is_featured: false },
      ])
      .select("id, name");
    charities = inserted ?? [];
  }

  // --- Subscribers -------------------------------------------------------
  const subscriberDefs = [
    { email: "subscriber1@digitalheroes.test", name: "Priya Shah", plan: "monthly", scores: [22, 25, 19, 30, 27] },
    { email: "subscriber2@digitalheroes.test", name: "Marcus Webb", plan: "yearly", scores: [15, 18, 14] },
    { email: "subscriber3@digitalheroes.test", name: "Aiko Tanaka", plan: "monthly", scores: [33, 29, 35, 31, 28] },
  ];

  let i = 0;
  for (const sub of subscriberDefs) {
    const userId = await createUser(sub.email, sub.name);

    // subscriptions has no unique constraint on user_id (only on
    // stripe_subscription_id), so this is a manual check-then-write
    // rather than a Postgres-level upsert.
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const subRow = {
      user_id: userId,
      plan: sub.plan,
      status: "active",
      charity_id: charities[i % charities.length]?.id,
      charity_contribution_pct: 10,
    };
    if (existingSub) {
      await supabase.from("subscriptions").update(subRow).eq("id", existingSub.id);
    } else {
      await supabase.from("subscriptions").insert(subRow);
    }

    const today = new Date();
    for (let d = 0; d < sub.scores.length; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d * 7);
      await supabase.from("scores").upsert(
        {
          user_id: userId,
          score: sub.scores[d],
          score_date: date.toISOString().slice(0, 10),
        },
        { onConflict: "user_id,score_date" }
      );
    }

    console.log(`✓ Subscriber: ${sub.email} / ${SEED_PASSWORD}  (${sub.scores.length} scores, ${sub.plan})`);
    i++;
  }

  console.log("\nDone. All seeded accounts share the password:", SEED_PASSWORD);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message ?? err);
  process.exit(1);
});
