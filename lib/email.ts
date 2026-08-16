/**
 * Email notifications — PRD §13: "system updates, draw results, winner
 * alerts."
 *
 * Uses Resend's plain HTTP API (https://resend.com) via fetch, so no SDK
 * dependency is required. If RESEND_API_KEY isn't set, every function
 * here logs what it would have sent and returns without throwing — so
 * local dev / a sandboxed build never breaks for lack of a real email
 * provider, but the exact same code path sends real email in production
 * once the env var is configured (see .env.example).
 *
 * Swap providers by editing only `sendEmail` below — every call site in
 * the app goes through the template functions, not the raw API.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

type EmailRecipient = { email: string; name?: string | null };

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Digital Heroes <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[email:noop] RESEND_API_KEY not set — would have sent "${opts.subject}" to ${opts.to}`);
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend returned ${res.status} for "${opts.subject}" -> ${opts.to}: ${body}`);
      return { sent: false, error: `Resend ${res.status}: ${body}` };
    }
    return { sent: true };
  } catch (e: any) {
    console.error(`[email] Failed to send "${opts.subject}" to ${opts.to}:`, e);
    return { sent: false, error: e.message ?? "Unknown email error" };
  }
}

function wrapper(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <p style="font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #b08d57;">Digital Heroes</p>
      <h1 style="font-size: 22px; margin: 8px 0 16px;">${title}</h1>
      ${bodyHtml}
      <p style="margin-top: 32px; font-size: 12px; color: #888;">
        You're receiving this because you have an account on Digital Heroes.
      </p>
    </div>
  `;
}

/** System update: sent right after a subscription is confirmed by the Stripe webhook. */
export async function sendSubscriptionConfirmedEmail(
  email: string,
  name: string | null | undefined,
  details: { plan: "monthly" | "yearly"; charityName?: string | null }
) {
  return sendEmail({
    to: email,
    subject: "Your Digital Heroes subscription is active",
    html: wrapper(
      "You're in",
      `<p>Hi ${name || "there"}, your ${details.plan} subscription is now active.</p>
       ${details.charityName ? `<p>You're supporting <strong>${details.charityName}</strong> with every payment.</p>` : ""}
       <p>Head to your dashboard to enter your latest scores and get into this month's draw.</p>`
    ),
  });
}

/** Draw results: sent to every active subscriber once an admin publishes a draw. */
export async function sendDrawPublishedEmail(
  recipients: EmailRecipient[],
  draw: { month: string; draw_type: string; winning_numbers: number[] }
) {
  const monthLabel = new Date(draw.month).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendEmail({
        to: r.email,
        subject: `${monthLabel} draw results are in`,
        html: wrapper(
          "This month's numbers",
          `<p>Hi ${r.name || "there"}, the ${monthLabel} ${draw.draw_type} draw has been published.</p>
           <p style="font-size: 20px; font-weight: 600; letter-spacing: 0.05em;">${draw.winning_numbers.join(" · ")}</p>
           <p>Log in to your dashboard to see if you matched.</p>`
        ),
      })
    )
  );
  return results;
}

/** Winner alert: sent to each individual winner right after a draw is published. */
export async function sendWinnerAlertEmail(
  email: string,
  name: string | null | undefined,
  win: { tier: "5" | "4" | "3"; prize_amount: number; month: string }
) {
  const monthLabel = new Date(win.month).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
  return sendEmail({
    to: email,
    subject: `You won! ${win.tier}-number match — ${monthLabel}`,
    html: wrapper(
      "Congratulations 🎉",
      `<p>Hi ${name || "there"}, you matched ${win.tier} numbers in the ${monthLabel} draw.</p>
       <p style="font-size: 20px; font-weight: 600;">Prize: $${win.prize_amount.toFixed(2)}</p>
       <p>Upload your proof of score from your dashboard so we can verify and process your payout.</p>`
    ),
  });
}

/** Winner alert: verification approved/rejected. */
export async function sendVerificationStatusEmail(
  email: string,
  name: string | null | undefined,
  status: "approved" | "rejected"
) {
  return sendEmail({
    to: email,
    subject: status === "approved" ? "Your win has been verified" : "There was an issue verifying your win",
    html: wrapper(
      status === "approved" ? "Verified" : "Verification issue",
      status === "approved"
        ? `<p>Hi ${name || "there"}, your proof has been reviewed and approved. Your payout is now being processed.</p>`
        : `<p>Hi ${name || "there"}, we couldn't verify your submitted proof. Please log in and re-upload a clear screenshot of your scores.</p>`
    ),
  });
}

/** Winner alert: payout marked as paid. */
export async function sendPayoutPaidEmail(
  email: string,
  name: string | null | undefined,
  amount: number
) {
  return sendEmail({
    to: email,
    subject: "Your prize has been paid out",
    html: wrapper(
      "Payout complete",
      `<p>Hi ${name || "there"}, your prize of $${amount.toFixed(2)} has been marked as paid. Thanks for playing — and for backing your charity.</p>`
    ),
  });
}

/** System update: sent right after signup, as a welcome / confirmation. */
export async function sendWelcomeEmail(email: string, name: string | null | undefined) {
  return sendEmail({
    to: email,
    subject: "Welcome to Digital Heroes",
    html: wrapper(
      "Welcome",
      `<p>Hi ${name || "there"}, your account is ready. Subscribe to a plan and pick a charity to get started.</p>`
    ),
  });
}
