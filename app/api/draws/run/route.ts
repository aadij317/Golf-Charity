import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDrawPublishedEmail, sendWinnerAlertEmail } from "@/lib/email";
import { getStripe } from "@/lib/stripe";

/**
 * Draw engine invariants:
 * - only admins can run it
 * - there is one published draw per calendar month
 * - publish can only consume an unexpired server-owned simulation snapshot
 * - the published draw therefore uses the exact subscribers, scores, numbers,
 *   prize pool and rollover that the admin reviewed in the preview
 * - all money is calculated in integer cents and split deterministically
 */

const SCORE_MIN = 1;
const SCORE_MAX = 45;
const NUMBERS_DRAWN = 5;
const SIMULATION_TTL_MS = 30 * 60 * 1000;
const TIER_SPLIT = { "5": 40, "4": 35, "3": 25 } as const;
type Tier = keyof typeof TIER_SPLIT;
type DrawType = "random" | "algorithmic";
type Weighting = "favor_rare" | "favor_common";

type EntrySnapshot = {
  user_id: string;
  matches: number;
  matched_tier: Tier | null;
  prize_amount: number | null;
};

type TierSummary = {
  winners: number;
  pool: number;
  payout_total: number;
  prize_each_min: number;
  prize_each_max: number;
};

type SimulationSnapshot = {
  month: string;
  draw_type: DrawType;
  algorithm_weighting?: Weighting;
  winning_numbers: number[];
  active_subscribers: number;
  total_prize_pool: number;
  jackpot_rollover_amount: number;
  tiers: Record<Tier, TierSummary>;
  entries: EntrySnapshot[];
};

class DrawOperationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type RunBody = {
  mode: "simulate" | "publish";
  month: string;
  draw_type: DrawType;
  algorithm_weighting?: Weighting;
  simulation_id?: string;
};

function isValidBody(value: unknown): value is RunBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (body.mode !== "simulate" && body.mode !== "publish") return false;
  if (typeof body.month !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.month)) return false;
  if (body.draw_type !== "random" && body.draw_type !== "algorithmic") return false;
  if (body.algorithm_weighting !== undefined && body.algorithm_weighting !== "favor_rare" && body.algorithm_weighting !== "favor_common") return false;
  if (body.mode === "publish" && (typeof body.simulation_id !== "string" || body.simulation_id.length < 10)) return false;
  return true;
}

function isFirstDayOfMonth(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value.endsWith("-01");
}

function weightedDraw(weights: Map<number, number>): number[] {
  const pool = new Map(weights);
  const picked: number[] = [];
  while (picked.length < NUMBERS_DRAWN && pool.size > 0) {
    const total = [...pool.values()].reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * total;
    let chosen: number | null = null;
    for (const [number, weight] of pool) {
      random -= weight;
      if (random <= 0) {
        chosen = number;
        break;
      }
    }
    if (chosen === null) chosen = [...pool.keys()][0];
    picked.push(chosen);
    pool.delete(chosen);
  }
  return picked.sort((a, b) => a - b);
}

function uniformNumbers() {
  return weightedDraw(new Map(Array.from({ length: SCORE_MAX }, (_, index) => [index + SCORE_MIN, 1])));
}

function toCents(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100);
}

function fromCents(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function splitPool(totalCents: number) {
  // 40% + 35% + 25% = 100%. Allocate every cent deterministically so no
  // money disappears due to floating-point rounding.
  const five = Math.floor((totalCents * TIER_SPLIT["5"]) / 100);
  const four = Math.floor((totalCents * TIER_SPLIT["4"]) / 100);
  const three = totalCents - five - four;
  return { "5": five, "4": four, "3": three } satisfies Record<Tier, number>;
}

function distributeCents(poolCents: number, winnerIds: string[]) {
  const sorted = [...winnerIds].sort();
  if (!sorted.length) return new Map<string, number>();
  const base = Math.floor(poolCents / sorted.length);
  const remainder = poolCents % sorted.length;
  return new Map(sorted.map((id, index) => [id, base + (index < remainder ? 1 : 0)]));
}

async function getFeesInCents() {
  const monthlyPriceId = process.env.STRIPE_PRICE_ID_MONTHLY;
  const yearlyPriceId = process.env.STRIPE_PRICE_ID_YEARLY;
  if (!monthlyPriceId || !yearlyPriceId) throw new Error("Stripe price IDs are not configured");
  const stripe = getStripe();
  const [monthlyPrice, yearlyPrice] = await Promise.all([
    stripe.prices.retrieve(monthlyPriceId),
    stripe.prices.retrieve(yearlyPriceId),
  ]);
  const monthly = Number(monthlyPrice.unit_amount ?? 0);
  const yearly = Number(yearlyPrice.unit_amount ?? 0);
  if (monthly <= 0 || yearly <= 0) throw new Error("Configured Stripe prices must have a positive unit amount");
  return { monthly, yearly };
}

async function buildSnapshot({
  admin,
  month,
  drawType,
  weighting,
}: {
  admin: ReturnType<typeof createAdminClient>;
  month: string;
  drawType: DrawType;
  weighting: Weighting;
}): Promise<SimulationSnapshot> {
  const { data: activeSubs, error: subscriptionsError } = await admin
    .from("subscriptions")
    .select("user_id, plan, charity_contribution_pct")
    .eq("status", "active")
    .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`);
  if (subscriptionsError) throw new Error(subscriptionsError.message);

  const subscriptions = (activeSubs ?? []) as Array<{
    user_id: string;
    plan: "monthly" | "yearly";
    charity_contribution_pct: number;
  }>;
  const userIds = [...new Set(subscriptions.map((subscription) => subscription.user_id))];

  const { data: scoreRows, error: scoresError } = userIds.length
    ? await admin.from("scores").select("user_id, score").in("user_id", userIds)
    : { data: [], error: null };
  if (scoresError) throw new Error(scoresError.message);

  const scoresByUser = new Map<string, Set<number>>();
  for (const row of scoreRows ?? []) {
    if (!scoresByUser.has(row.user_id)) scoresByUser.set(row.user_id, new Set());
    scoresByUser.get(row.user_id)!.add(row.score);
  }

  let winningNumbers: number[];
  if (drawType === "random") {
    winningNumbers = uniformNumbers();
  } else {
    const frequency = new Map<number, number>();
    for (let number = SCORE_MIN; number <= SCORE_MAX; number++) frequency.set(number, 0);
    for (const scores of scoresByUser.values()) {
      for (const score of scores) frequency.set(score, (frequency.get(score) ?? 0) + 1);
    }
    const weights = new Map<number, number>();
    for (const [number, frequencyCount] of frequency) {
      weights.set(number, weighting === "favor_rare" ? 1 / (frequencyCount + 1) : frequencyCount + 1);
    }
    winningNumbers = weightedDraw(weights);
  }

  const entries: EntrySnapshot[] = userIds.map((userId) => {
    const scores = scoresByUser.get(userId) ?? new Set<number>();
    const matches = winningNumbers.filter((number) => scores.has(number)).length;
    return {
      user_id: userId,
      matches,
      matched_tier: matches >= 3 ? (String(matches) as Tier) : null,
      prize_amount: null,
    };
  });

  const fees = await getFeesInCents();
  let basePoolCents = 0;
  for (const subscription of subscriptions) {
    // Yearly plans contribute one twelfth of the annual fee to each monthly
    // draw. Keep the calculation in cents and round once per subscriber.
    const monthlyEquivalent = subscription.plan === "yearly" ? fees.yearly / 12 : fees.monthly;
    const contributionPct = Number(subscription.charity_contribution_pct);
    basePoolCents += Math.round(monthlyEquivalent * (1 - contributionPct / 100));
  }

  const { data: laterDraw, error: laterDrawError } = await admin
    .from("draws")
    .select("id, month")
    .eq("status", "published")
    .gt("month", month)
    .order("month", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (laterDrawError) throw new Error(laterDrawError.message);
  if (laterDraw) throw new DrawOperationError(`Cannot publish ${month} after a later published draw (${laterDraw.month}).`, 409);

  const { data: previousDraw, error: previousDrawError } = await admin
    .from("draws")
    .select("jackpot_rollover_amount")
    .eq("status", "published")
    .lt("month", month)
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousDrawError) throw new Error(previousDrawError.message);

  const rolloverCents = toCents(Number(previousDraw?.jackpot_rollover_amount ?? 0));
  const split = splitPool(basePoolCents);
  const tierPoolsCents: Record<Tier, number> = {
    "5": split["5"] + rolloverCents,
    "4": split["4"],
    "3": split["3"],
  };

  const winnerIdsByTier: Record<Tier, string[]> = {
    "5": entries.filter((entry) => entry.matched_tier === "5").map((entry) => entry.user_id),
    "4": entries.filter((entry) => entry.matched_tier === "4").map((entry) => entry.user_id),
    "3": entries.filter((entry) => entry.matched_tier === "3").map((entry) => entry.user_id),
  };

  const payoutsByUser = new Map<string, number>();
  for (const tier of ["5", "4", "3"] as Tier[]) {
    for (const [userId, cents] of distributeCents(tierPoolsCents[tier], winnerIdsByTier[tier])) {
      payoutsByUser.set(userId, cents);
    }
  }
  for (const entry of entries) {
    if (entry.matched_tier) entry.prize_amount = fromCents(payoutsByUser.get(entry.user_id) ?? 0);
  }

  const tiers = (Object.keys(TIER_SPLIT) as Tier[]).reduce((result, tier) => {
    const payouts = winnerIdsByTier[tier].map((id) => payoutsByUser.get(id) ?? 0);
    result[tier] = {
      winners: payouts.length,
      pool: fromCents(tierPoolsCents[tier]),
      payout_total: fromCents(payouts.reduce((sum, value) => sum + value, 0)),
      prize_each_min: payouts.length ? fromCents(Math.min(...payouts)) : 0,
      prize_each_max: payouts.length ? fromCents(Math.max(...payouts)) : 0,
    };
    return result;
  }, {} as Record<Tier, TierSummary>);

  const newRolloverCents = winnerIdsByTier["5"].length === 0 ? tierPoolsCents["5"] : 0;
  return {
    month,
    draw_type: drawType,
    algorithm_weighting: drawType === "algorithmic" ? weighting : undefined,
    winning_numbers: winningNumbers,
    active_subscribers: userIds.length,
    total_prize_pool: fromCents(basePoolCents),
    jackpot_rollover_amount: fromCents(newRolloverCents),
    tiers,
    entries,
  };
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!isValidBody(body) || !isFirstDayOfMonth(body.month)) {
    return NextResponse.json({ error: "Invalid draw request. month must be YYYY-MM-01 and publish requires a simulation." }, { status: 400 });
  }
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  if (body.month > currentMonth) {
    return NextResponse.json({ error: "Future months cannot be simulated or published before their calendar month begins." }, { status: 400 });
  }

  const admin = createAdminClient();
  const weighting = body.algorithm_weighting ?? "favor_rare";

  try {
    if (body.mode === "simulate") {
      // Opportunistic cleanup keeps the transient snapshot table bounded without
      // requiring a separate cron job. Published snapshots remain as audit data.
      await admin.from("draw_simulations").delete().is("published_at", null).lt("expires_at", new Date().toISOString());

      const { data: existing, error: existingError } = await admin
        .from("draws")
        .select("id")
        .eq("month", body.month)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existing) return NextResponse.json({ error: "This month has already been published and cannot be simulated again." }, { status: 409 });

      const snapshot = await buildSnapshot({ admin, month: body.month, drawType: body.draw_type, weighting });
      const expiresAt = new Date(Date.now() + SIMULATION_TTL_MS).toISOString();
      const { data: simulation, error: simulationError } = await admin
        .from("draw_simulations")
        .insert({
          month: body.month,
          draw_type: body.draw_type,
          algorithm_weighting: body.draw_type === "algorithmic" ? weighting : null,
          snapshot,
          created_by: user.id,
          expires_at: expiresAt,
        })
        .select("id, expires_at")
        .single();
      if (simulationError || !simulation) throw new Error(simulationError?.message ?? "Could not save simulation preview");

      return NextResponse.json({ ...snapshot, simulation_id: simulation.id, simulation_expires_at: simulation.expires_at }, { status: 200 });
    }

    const { data: existingDraw, error: existingDrawError } = await admin
      .from("draws")
      .select("id")
      .eq("month", body.month)
      .maybeSingle();
    if (existingDrawError) throw new Error(existingDrawError.message);
    if (existingDraw) return NextResponse.json({ error: "A draw for this month is already published." }, { status: 409 });

    const { data: simulation, error: simulationError } = await admin
      .from("draw_simulations")
      .select("id, month, draw_type, snapshot, expires_at, published_at, created_by")
      .eq("id", body.simulation_id!)
      .single();
    if (simulationError || !simulation) return NextResponse.json({ error: "Simulation preview not found. Run it again." }, { status: 404 });
    if (simulation.created_by !== user.id) return NextResponse.json({ error: "Only the admin who created this preview can publish it." }, { status: 403 });
    if (simulation.published_at) return NextResponse.json({ error: "This simulation has already been published." }, { status: 409 });
    if (new Date(simulation.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Simulation expired. Run it again before publishing." }, { status: 410 });
    if (simulation.month !== body.month || simulation.draw_type !== body.draw_type) return NextResponse.json({ error: "Simulation does not match the selected month and draw type." }, { status: 409 });

    const snapshot = simulation.snapshot as unknown as SimulationSnapshot;
    if (!snapshot || snapshot.month !== body.month || !Array.isArray(snapshot.entries) || snapshot.winning_numbers?.length !== NUMBERS_DRAWN) {
      return NextResponse.json({ error: "Simulation data is invalid. Run it again." }, { status: 409 });
    }

    const { data: draw, error: drawError } = await admin
      .from("draws")
      .insert({
        month: snapshot.month,
        draw_type: snapshot.draw_type,
        status: "published",
        winning_numbers: snapshot.winning_numbers,
        jackpot_rollover_amount: snapshot.jackpot_rollover_amount,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (drawError || !draw) {
      if (drawError?.code === "23505") return NextResponse.json({ error: "A draw for this month is already published." }, { status: 409 });
      throw new Error(drawError?.message ?? "Failed to create draw");
    }

    const entries = snapshot.entries;
    if (entries.length) {
      const { error } = await admin.from("draw_entries").insert(entries.map((entry) => ({
        draw_id: draw.id,
        user_id: entry.user_id,
        matched_tier: entry.matched_tier,
      })));
      if (error) {
        await admin.from("draws").delete().eq("id", draw.id);
        throw new Error(`Failed to create draw entries: ${error.message}`);
      }
    }

    const winnerRows = entries
      .filter((entry) => entry.matched_tier && entry.prize_amount !== null)
      .map((entry) => ({
        draw_id: draw.id,
        user_id: entry.user_id,
        tier: entry.matched_tier as Tier,
        prize_amount: entry.prize_amount as number,
      }));
    if (winnerRows.length) {
      const { error } = await admin.from("winners").insert(winnerRows);
      if (error) {
        await admin.from("draws").delete().eq("id", draw.id);
        throw new Error(`Failed to create winners: ${error.message}`);
      }
    }

    const { error: markSimulationError } = await admin
      .from("draw_simulations")
      .update({ published_at: new Date().toISOString() })
      .eq("id", simulation.id)
      .is("published_at", null);
    if (markSimulationError) {
      // The draw is already durable; do not delete it after side effects. The
      // unique month constraint still prevents a second published draw.
      console.error("Could not mark simulation as published:", markSimulationError);
    }

    try {
      if (entries.length) {
        const { data: subscriberProfiles } = await admin.from("profiles").select("email, full_name").in("id", entries.map((entry) => entry.user_id));
        if (subscriberProfiles?.length) await sendDrawPublishedEmail(
          (subscriberProfiles as Array<{ email: string; full_name: string | null }>).map((item) => ({ email: item.email, name: item.full_name })),
          { month: snapshot.month, draw_type: snapshot.draw_type, winning_numbers: snapshot.winning_numbers }
        );
      }
      if (winnerRows.length) {
        const winnerIds = [...new Set(winnerRows.map((row) => row.user_id))];
        const { data: winnerProfiles } = await admin.from("profiles").select("id, email, full_name").in("id", winnerIds);
        const profileById = new Map(
          ((winnerProfiles ?? []) as Array<{ id: string; email: string; full_name: string | null }>).map((item) => [item.id, item])
        );
        for (const winner of winnerRows) {
          const winnerProfile = profileById.get(winner.user_id);
          if (winnerProfile) await sendWinnerAlertEmail(winnerProfile.email, winnerProfile.full_name, {
            tier: winner.tier,
            prize_amount: Number(winner.prize_amount),
            month: snapshot.month,
          });
        }
      }
    } catch (emailError) {
      console.error("Draw notification emails failed:", emailError);
    }

    return NextResponse.json({ draw, ...snapshot }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Draw operation failed" },
      { status: error instanceof DrawOperationError ? error.status : 500 }
    );
  }
}
