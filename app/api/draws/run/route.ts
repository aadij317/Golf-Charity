import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDrawPublishedEmail, sendWinnerAlertEmail } from "@/lib/email";

/**
 * POST /api/draws/run
 *
 * Called by app/admin/draws/actions.ts (runDraw), which forwards the
 * calling admin's own session cookie. This route re-checks admin-ness
 * itself (never trust the caller) using the cookie-bound anon client,
 * then does all the actual reads/writes with the service-role client so
 * it can see every subscriber's scores/subscriptions, not just the
 * admin's own RLS-visible rows.
 *
 * Body:
 *   mode: "simulate" | "publish"
 *   month: "YYYY-MM-01"
 *   draw_type: "random" | "algorithmic"
 *   algorithm_weighting?: "favor_rare" | "favor_common"   (algorithmic only)
 *   subscription_fee?: number                              (defaults to 25)
 *
 * "simulate" computes and returns a full preview — winning numbers,
 * matched entries, prize breakdown — WITHOUT writing anything to the DB.
 * "publish" does the same computation, then persists it: one row in
 * draws, one draw_entries row per active subscriber (matched_tier set
 * only if they matched 3/4/5), and one winners row per matched entry.
 *
 * PRIZE POOL SPLIT: locked to PRD §07 exactly — 5-match 40% (jackpot,
 * rolls over if unclaimed), 4-match 35% (no rollover), 3-match 25% (no
 * rollover). The $25 default subscription fee is a placeholder only used
 * when the caller doesn't pass `subscription_fee`; pass the real fee (or
 * derive it from Stripe price data) in production.
 */

const SCORE_MIN = 1;
const SCORE_MAX = 45;
const NUMBERS_DRAWN = 5;

const DEFAULT_SUBSCRIPTION_FEE = 25;
// Prize pool split across the three matchable tiers — PRD §07.
const TIER_SPLIT: Record<"5" | "4" | "3", number> = {
  "5": 0.4,
  "4": 0.35,
  "3": 0.25,
};

type RunBody = {
  mode: "simulate" | "publish";
  month: string;
  draw_type: "random" | "algorithmic";
  algorithm_weighting?: "favor_rare" | "favor_common";
  subscription_fee?: number;
};

function isValidBody(b: any): b is RunBody {
  if (!b || typeof b !== "object") return false;
  if (b.mode !== "simulate" && b.mode !== "publish") return false;
  if (typeof b.month !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.month)) return false;
  if (b.draw_type !== "random" && b.draw_type !== "algorithmic") return false;
  if (
    b.algorithm_weighting !== undefined &&
    b.algorithm_weighting !== "favor_rare" &&
    b.algorithm_weighting !== "favor_common"
  ) {
    return false;
  }
  if (b.subscription_fee !== undefined && typeof b.subscription_fee !== "number") return false;
  return true;
}

/** Weighted sample of NUMBERS_DRAWN unique ints from [SCORE_MIN, SCORE_MAX]. */
function weightedDraw(weights: Map<number, number>): number[] {
  const pool = new Map(weights);
  const picked: number[] = [];

  while (picked.length < NUMBERS_DRAWN && pool.size > 0) {
    const total = [...pool.values()].reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let chosen: number | null = null;
    for (const [num, w] of pool) {
      r -= w;
      if (r <= 0) {
        chosen = num;
        break;
      }
    }
    if (chosen === null) chosen = [...pool.keys()][0];
    picked.push(chosen);
    pool.delete(chosen);
  }
  return picked.sort((a, b) => a - b);
}

function uniformNumbers(): number[] {
  const all = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => i + SCORE_MIN);
  const weights = new Map(all.map((n) => [n, 1]));
  return weightedDraw(weights);
}

export async function POST(req: NextRequest) {
  // --- 1. Auth: verify the forwarded session belongs to a real admin ---
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // --- 2. Validate body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const {
    mode,
    month,
    draw_type,
    algorithm_weighting = "favor_rare",
    subscription_fee = DEFAULT_SUBSCRIPTION_FEE,
  } = body;

  const admin = createAdminClient();

  // --- 3. If publishing, make sure this month/type hasn't been run yet ---
  if (mode === "publish") {
    const { data: existing } = await admin
      .from("draws")
      .select("id, status")
      .eq("month", month)
      .eq("draw_type", draw_type)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A draw for this month/type already exists.", existing },
        { status: 409 }
      );
    }
  }

  // --- 4. Gather active subscribers and their latest scores ---
  const { data: activeSubs, error: subsErr } = await admin
    .from("subscriptions")
    .select("user_id, charity_contribution_pct")
    .eq("status", "active");

  if (subsErr) {
    return NextResponse.json({ error: subsErr.message }, { status: 500 });
  }

  const activeUserIds = (activeSubs ?? []).map((s) => s.user_id);

  const { data: scoreRows, error: scoresErr } = activeUserIds.length
    ? await admin.from("scores").select("user_id, score").in("user_id", activeUserIds)
    : { data: [], error: null };

  if (scoresErr) {
    return NextResponse.json({ error: scoresErr.message }, { status: 500 });
  }

  const scoresByUser = new Map<string, Set<number>>();
  for (const row of scoreRows ?? []) {
    if (!scoresByUser.has(row.user_id)) scoresByUser.set(row.user_id, new Set());
    scoresByUser.get(row.user_id)!.add(row.score);
  }

  // --- 5. Pick winning numbers ---
  let winningNumbers: number[];
  if (draw_type === "random") {
    winningNumbers = uniformNumbers();
  } else {
    // Algorithmic: weight by how common/rare each score currently is
    // across all active subscribers' latest scores.
    const frequency = new Map<number, number>();
    for (let n = SCORE_MIN; n <= SCORE_MAX; n++) frequency.set(n, 0);
    for (const set of scoresByUser.values()) {
      for (const s of set) frequency.set(s, (frequency.get(s) ?? 0) + 1);
    }
    const weights = new Map<number, number>();
    for (const [num, freq] of frequency) {
      weights.set(num, algorithm_weighting === "favor_rare" ? 1 / (freq + 1) : freq + 1);
    }
    winningNumbers = weightedDraw(weights);
  }

  // --- 6. Match each active subscriber against the winning numbers ---
  type Entry = { user_id: string; matches: number; matched_tier: "5" | "4" | "3" | null };
  const entries: Entry[] = activeUserIds.map((user_id) => {
    const userScores = scoresByUser.get(user_id) ?? new Set<number>();
    const matches = winningNumbers.filter((n) => userScores.has(n)).length;
    const matched_tier = matches >= 3 ? (String(matches) as "5" | "4" | "3") : null;
    return { user_id, matches, matched_tier };
  });

  // --- 7. Prize pool math ---
  const subsByUser = new Map((activeSubs ?? []).map((s) => [s.user_id, s]));
  let totalPool = 0;
  for (const userId of activeUserIds) {
    const pct = subsByUser.get(userId)?.charity_contribution_pct ?? 10;
    totalPool += subscription_fee * (1 - pct / 100);
  }

  const { data: lastDraw } = await admin
    .from("draws")
    .select("jackpot_rollover_amount")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousRollover = lastDraw?.jackpot_rollover_amount ?? 0;

  const tierPools: Record<"5" | "4" | "3", number> = {
    "5": totalPool * TIER_SPLIT["5"] + previousRollover,
    "4": totalPool * TIER_SPLIT["4"],
    "3": totalPool * TIER_SPLIT["3"],
  };

  const winnersByTier: Record<"5" | "4" | "3", Entry[]> = {
    "5": entries.filter((e) => e.matched_tier === "5"),
    "4": entries.filter((e) => e.matched_tier === "4"),
    "3": entries.filter((e) => e.matched_tier === "3"),
  };

  const prizePerWinner: Record<"5" | "4" | "3", number> = {
    "5": winnersByTier["5"].length ? tierPools["5"] / winnersByTier["5"].length : 0,
    "4": winnersByTier["4"].length ? tierPools["4"] / winnersByTier["4"].length : 0,
    "3": winnersByTier["3"].length ? tierPools["3"] / winnersByTier["3"].length : 0,
  };

  // Only the top tier rolls over to the next draw if nobody hit it.
  const newRollover = winnersByTier["5"].length === 0 ? tierPools["5"] : 0;

  const summary = {
    month,
    draw_type,
    algorithm_weighting: draw_type === "algorithmic" ? algorithm_weighting : undefined,
    winning_numbers: winningNumbers,
    subscription_fee,
    active_subscribers: activeUserIds.length,
    total_prize_pool: Number(totalPool.toFixed(2)),
    jackpot_rollover_amount: Number(newRollover.toFixed(2)),
    tiers: {
      "5": { winners: winnersByTier["5"].length, pool: Number(tierPools["5"].toFixed(2)), prize_each: Number(prizePerWinner["5"].toFixed(2)) },
      "4": { winners: winnersByTier["4"].length, pool: Number(tierPools["4"].toFixed(2)), prize_each: Number(prizePerWinner["4"].toFixed(2)) },
      "3": { winners: winnersByTier["3"].length, pool: Number(tierPools["3"].toFixed(2)), prize_each: Number(prizePerWinner["3"].toFixed(2)) },
    },
  };

  // --- 8. Simulate: return the preview, write nothing ---
  if (mode === "simulate") {
    return NextResponse.json(summary, { status: 200 });
  }

  // --- 9. Publish: persist draw, entries, winners ---
  const { data: draw, error: drawErr } = await admin
    .from("draws")
    .insert({
      month,
      draw_type,
      status: "published",
      winning_numbers: winningNumbers,
      jackpot_rollover_amount: newRollover,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (drawErr || !draw) {
    return NextResponse.json({ error: drawErr?.message ?? "Failed to create draw" }, { status: 500 });
  }

  if (entries.length) {
    const { error: entriesErr } = await admin.from("draw_entries").insert(
      entries.map((e) => ({
        draw_id: draw.id,
        user_id: e.user_id,
        matched_tier: e.matched_tier,
      }))
    );
    if (entriesErr) {
      return NextResponse.json(
        { error: `Draw created but entries failed: ${entriesErr.message}`, draw },
        { status: 500 }
      );
    }
  }

  const winnerRows = entries
    .filter((e) => e.matched_tier !== null)
    .map((e) => ({
      draw_id: draw.id,
      user_id: e.user_id,
      tier: e.matched_tier as "5" | "4" | "3",
      prize_amount: prizePerWinner[e.matched_tier as "5" | "4" | "3"],
    }));

  if (winnerRows.length) {
    const { error: winnersErr } = await admin.from("winners").insert(winnerRows);
    if (winnersErr) {
      return NextResponse.json(
        { error: `Draw created but winners failed: ${winnersErr.message}`, draw },
        { status: 500 }
      );
    }
  }

  // --- 10. Email notifications (PRD §13) ---
  // Awaited (not fire-and-forget): Vercel serverless functions can be
  // frozen/terminated immediately after the response is sent, so a
  // detached async call here would risk never actually delivering the
  // emails. A failure here is logged and swallowed — it never rolls back
  // the draw, which already committed above. sendDrawPublishedEmail /
  // sendWinnerAlertEmail no-op safely (with a console log) if
  // RESEND_API_KEY isn't configured — see lib/email.ts.
  {
    try {
      if (activeUserIds.length) {
        const { data: subscriberProfiles } = await admin
          .from("profiles")
          .select("email, full_name")
          .in("id", activeUserIds);

        if (subscriberProfiles?.length) {
          await sendDrawPublishedEmail(
            subscriberProfiles.map((p) => ({ email: p.email, name: p.full_name })),
            { month, draw_type, winning_numbers: winningNumbers }
          );
        }
      }

      if (winnerRows.length) {
        const winnerUserIds = [...new Set(winnerRows.map((w) => w.user_id))];
        const { data: winnerProfiles } = await admin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", winnerUserIds);

        const profileById = new Map((winnerProfiles ?? []).map((p) => [p.id, p]));
        for (const w of winnerRows) {
          const profile = profileById.get(w.user_id);
          if (!profile) continue;
          await sendWinnerAlertEmail(profile.email, profile.full_name, {
            tier: w.tier,
            prize_amount: w.prize_amount,
            month,
          });
        }
      }
    } catch (e) {
      // Notification failures are logged, not surfaced — the draw itself
      // already published successfully.
      console.error("Draw notification emails failed:", e);
    }
  }

  return NextResponse.json({ draw, ...summary }, { status: 200 });
}
