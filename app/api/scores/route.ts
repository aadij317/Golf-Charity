import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";

/**
 * POST /api/scores
 *
 * Lets a signed-in subscriber submit their own score for a given date.
 * Uses the cookie-bound client (not service-role) so RLS itself enforces
 * "you can only write your own scores" — this route doesn't need to
 * duplicate that check. The DB trigger (enforce_score_limit, see
 * 0001_init_schema.sql) automatically prunes to the 5 most recent scores
 * per user after every insert, and the (user_id, score_date) unique
 * constraint means resubmitting the same date just needs an upsert
 * (that's how "edit" works — resend the same date with a new score).
 *
 * PRD §04 requires a real-time subscription-status check on every
 * authenticated request that touches a gated feature — score entry is
 * one of those, so a lapsed/cancelled subscriber gets a 403 here even if
 * their session is otherwise valid.
 *
 * Body: { score: number (1-45), score_date: "YYYY-MM-DD" }
 *
 * GET /api/scores returns the caller's own current scores (read-only —
 * not gated, so a lapsed subscriber can still see their own history).
 *
 * DELETE /api/scores?id=<score_id> removes a single score entry (PRD §13:
 * "An existing score entry for a date may only be edited or deleted").
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return NextResponse.json(
      { error: "An active subscription is required to submit scores." },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { score, score_date } = body ?? {};

  if (typeof score !== "number" || score < 1 || score > 45) {
    return NextResponse.json({ error: "score must be a number between 1 and 45" }, { status: 400 });
  }
  if (typeof score_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(score_date)) {
    return NextResponse.json({ error: "score_date must be YYYY-MM-DD" }, { status: 400 });
  }

  // A regex alone accepts impossible dates such as 2026-99-99.
  const parsedDate = new Date(`${score_date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== score_date) {
    return NextResponse.json({ error: "score_date must be a valid calendar date" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("scores")
    .upsert(
      { user_id: user.id, score, score_date },
      { onConflict: "user_id,score_date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ score: data }, { status: 200 });
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("scores")
    .select("id, score, score_date")
    .eq("user_id", user.id)
    .order("score_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scores: data }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return NextResponse.json(
      { error: "An active subscription is required to delete scores." },
      { status: 403 }
    );
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  }

  // No .eq("user_id", user.id) needed for correctness — RLS
  // (scores_delete_own_or_admin) already scopes this to the caller's own
  // rows — but it's included anyway so a mistaken id for someone else's
  // score returns a clean "not found" instead of a silent no-op.
  const { data, error } = await supabase
    .from("scores")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Score not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true }, { status: 200 });
}
