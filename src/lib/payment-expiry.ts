import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Payments older than this (hours) that never completed are abandoned. */
export const STALE_AFTER_HOURS = 24;

export type ExpiryResult = {
  expired: number; // payments marked abandoned
  ordersUpdated: number; // orders moved to a matching unpaid state
};

/**
 * Marks stale Paystack payments as abandoned.
 *
 * A payment is stale when it is still `pending` or `processing` (the customer
 * never completed — or never started — the Paystack checkout) and it was
 * created more than STALE_AFTER_HOURS ago.
 *
 * Bank transfer (`awaiting_payment`) and cash payments are intentionally NOT
 * touched — those legitimately wait for a human to confirm them.
 */
export async function expireStalePayments(): Promise<ExpiryResult> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3_600_000).toISOString();

  // 1. Find stale Paystack payments that never completed
  const { data: stale, error } = await admin
    .from("payments")
    .select("id, order_id")
    .eq("method", "paystack")
    .in("status", ["pending", "processing"])
    .lt("created_at", cutoff);

  if (error) {
    throw new Error(`Could not query stale payments: ${error.message}`);
  }

  if (!stale || stale.length === 0) {
    return { expired: 0, ordersUpdated: 0 };
  }

  const staleIds = stale.map((p) => p.id);
  const staleOrderIds = [...new Set(stale.map((p) => p.order_id))];

  // 2. Mark them abandoned — but never overwrite a paid/failed/refunded state
  //    that may have landed via webhook between the query and the update.
  const { data: updated, error: updateError } = await admin
    .from("payments")
    .update({ status: "abandoned" })
    .in("id", staleIds)
    .in("status", ["pending", "processing"])
    .select("id");

  if (updateError) {
    throw new Error(`Could not abandon payments: ${updateError.message}`);
  }

  // 3. Move affected orders out of "pending payment" so the storefront and
  //    admin views show them as closed, without touching paid/refunded orders.
  const { data: ordersUpdated, error: orderError } = await admin
    .from("orders")
    .update({ payment_status: "abandoned" })
    .in("id", staleOrderIds)
    .in("payment_status", ["pending", "processing"])
    .select("id");

  if (orderError) {
    console.error("[payment-expiry] order update failed:", orderError.message);
  }

  return { expired: updated?.length ?? 0, ordersUpdated: ordersUpdated?.length ?? 0 };
}
