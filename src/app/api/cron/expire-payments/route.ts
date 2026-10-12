import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { expireStalePayments, STALE_AFTER_HOURS } from "@/lib/payment-expiry";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: abandons Paystack payments that never completed within
 * STALE_AFTER_HOURS. Designed for a scheduled HTTP call (Vercel Cron,
 * GitHub Actions, Supabase pg_cron + pg_net, uptime monitor, …).
 *
 * Protect it with the CRON_SECRET env var:
 *   Authorization: Bearer <CRON_SECRET>
 * If CRON_SECRET is unset the endpoint refuses to run (403) — it can never
 * be triggered accidentally by a crawler hitting the URL.
 *
 * Vercel cron example (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/expire-payments",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";

  const expected = `Bearer ${secret ?? ""}`;
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (
    !secret ||
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const result = await expireStalePayments();
    return NextResponse.json({
      ok: true,
      expiredPayments: result.expired,
      ordersUpdated: result.ordersUpdated,
      staleAfterHours: STALE_AFTER_HOURS,
    });
  } catch (err) {
    console.error("[cron] expire-payments failed:", err);
    return NextResponse.json({ error: "Expiry run failed" }, { status: 500 });
  }
}

// Some cron services issue GET requests — allow it with the same auth.
export async function GET(request: NextRequest) {
  return POST(request);
}
