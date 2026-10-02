import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payment event names recorded in the timeline (public.payment_events).
 * Kept as a const object so call sites stay consistent.
 */
export const PAYMENT_EVENTS = {
  initialized: "initialized",
  verification_started: "verification_started",
  verified: "verified",
  webhook_received: "webhook_received",
  amount_mismatch: "amount_mismatch",
  failed: "failed",
  abandoned: "abandoned",
  manually_updated: "manually_updated",
} as const;

export type PaymentEventName = (typeof PAYMENT_EVENTS)[keyof typeof PAYMENT_EVENTS];

/**
 * Append an event to a payment's timeline. Best-effort: logging must never
 * break the payment flow it is observing, so errors are swallowed.
 */
export async function recordPaymentEvent(
  paymentId: string,
  event: PaymentEventName,
  detail?: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("payment_events").insert({
      payment_id: paymentId,
      event,
      detail: detail?.slice(0, 500) ?? null,
    });
    if (error) {
      console.error("[payment-events] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[payment-events] unexpected error:", err);
  }
}
