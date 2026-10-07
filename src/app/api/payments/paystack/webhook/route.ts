import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/paystack";
import { sendEmail } from "@/lib/email";
import { paymentConfirmedEmail, adminPaymentSuccessEmail } from "@/lib/email-templates";
import { recordPaymentEvent, PAYMENT_EVENTS } from "@/lib/payment-events";

export const dynamic = "force-dynamic";

type PaystackEvent = {
  event: string;
  data: {
    reference?: string;
    status?: string;
    amount?: number;
    [key: string]: unknown;
  };
};

/**
 * Paystack webhook. The event arrives from Paystack's servers:
 * - raw body is verified with HMAC-SHA512 against PAYSTACK_SECRET_KEY
 * - processing is idempotent: already-paid orders are skipped
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-paystack-signature");
  const rawBody = await request.text();

  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only handle charge.success; other events are acknowledged and ignored
  if (
    event.event !== "charge.success" ||
    typeof event.data?.reference !== "string" ||
    event.data.reference.length === 0 ||
    event.data.reference.length > 200
  ) {
    return NextResponse.json({ received: true });
  }

  const reference = event.data.reference;
  const admin = createAdminClient();

  // Idempotency check
  const { data: payment } = await admin
    .from("payments")
    .select("id, status, order_id, amount")
    .eq("reference", reference)
    .single();

  if (!payment) {
    console.warn(`[webhook] no payment found for reference ${reference}`);
    return NextResponse.json({ received: true, note: "unknown reference" });
  }

  await recordPaymentEvent(payment.id, PAYMENT_EVENTS.webhook_received, `Paystack event: ${event.event}`);

  if (payment.status === "paid") {
    return NextResponse.json({ received: true, note: "already processed" });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, total, payment_status")
    .eq("id", payment.order_id)
    .single();

  if (!order) {
    console.error(`[webhook] order ${payment.order_id} not found for reference ${reference}`);
    return NextResponse.json({ received: true, note: "order missing" });
  }

  // Verify the amount matches what Paystack reports
  if (typeof event.data.amount === "number" && event.data.amount !== Math.round(order.total * 100)) {
    console.error(
      `[webhook] amount mismatch for ${reference}: order ${order.total * 100}, event ${event.data.amount}`
    );
    await admin
      .from("payments")
      .update({ status: "failed", raw_payload: event.data as never })
      .eq("id", payment.id);
    await recordPaymentEvent(
      payment.id,
      PAYMENT_EVENTS.amount_mismatch,
      `Order expected ${Math.round(order.total * 100)} kobo, Paystack reported ${event.data.amount}`
    );
    await admin
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", order.id)
      .in("payment_status", ["pending", "processing"]);
    return NextResponse.json({ received: true, note: "amount mismatch — manual review needed" });
  }

  // Update payment + order. The status guards make the transition atomic and
  // prevent a late webhook from overwriting an admin-set state.
  const { data: paidRows } = await admin
    .from("payments")
    .update({ status: "paid", raw_payload: event.data as never })
    .eq("id", payment.id)
    .neq("status", "paid")
    .select("id");
  if (!paidRows?.[0]) {
    return NextResponse.json({ received: true, note: "already processed" });
  }

  const { data: paidOrders } = await admin
    .from("orders")
    .update({ payment_status: "paid", order_status: "paid" })
    .eq("id", order.id)
    .in("payment_status", ["pending", "processing"])
    .select("id");
  if (!paidOrders?.[0]) {
    await recordPaymentEvent(
      payment.id,
      PAYMENT_EVENTS.manually_updated,
      "Payment was paid, but the order was no longer payable; manual review needed"
    );
    return NextResponse.json({ received: true, note: "order not payable — manual review needed" });
  }

  // Emails
  const confirmation = paymentConfirmedEmail({
    orderNumber: order.order_number,
    customerName: order.customer_name,
    amountKobo: Math.round(order.total * 100),
  });
  void sendEmail({ to: order.customer_email, subject: confirmation.subject, html: confirmation.html });

  if (process.env.ADMIN_EMAIL) {
    const adminMail = adminPaymentSuccessEmail({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      amountKobo: Math.round(order.total * 100),
    });
    void sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: adminMail.subject,
      html: adminMail.html,
      replyTo: order.customer_email,
    });
  }

  return NextResponse.json({ received: true });
}
