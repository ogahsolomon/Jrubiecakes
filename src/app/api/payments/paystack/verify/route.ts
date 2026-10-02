import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";
import { sendEmail } from "@/lib/email";
import { paymentConfirmedEmail, adminPaymentSuccessEmail } from "@/lib/email-templates";
import { recordPaymentEvent, PAYMENT_EVENTS } from "@/lib/payment-events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference || reference.length > 200) {
    return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: if already processed, return current state without re-verifying
  const { data: existingPayment } = await admin
    .from("payments")
    .select("id, status, order_id")
    .eq("reference", reference)
    .single();

  if (existingPayment?.status === "paid") {
    const { data: order } = await admin
      .from("orders")
      .select("order_number")
      .eq("id", existingPayment.order_id)
      .single();
    return NextResponse.json({
      ok: true,
      status: "success",
      orderNumber: order?.order_number,
      message: "Payment already confirmed",
    });
  }

  if (existingPayment) {
    await recordPaymentEvent(existingPayment.id, PAYMENT_EVENTS.verification_started, "Callback verification");
  }

  // Verify with Paystack — never trust the client's claim of success
  const result = await verifyTransaction(reference);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, total")
    .eq("payment_reference", reference)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found for this payment" }, { status: 404 });
  }

  if (result.status === "success") {
    // Amount must match the order total exactly
    if (result.amountKobo !== Math.round(order.total * 100)) {
      console.error(
        `[paystack] amount mismatch for ${reference}: expected ${order.total * 100}, got ${result.amountKobo}`
      );
      const { data: mismatched } = await admin
        .from("payments")
        .update({ status: "failed", raw_payload: result.raw as never })
        .eq("reference", reference)
        .select("id");
      if (mismatched?.[0]) {
        await recordPaymentEvent(
          mismatched[0].id,
          PAYMENT_EVENTS.amount_mismatch,
          `Expected ${Math.round(order.total * 100)} kobo, Paystack reported ${result.amountKobo}`
        );
      }
      return NextResponse.json(
        { error: "Payment amount does not match the order. Please contact support." },
        { status: 400 }
      );
    }

    const { data: verifiedPayment } = await admin
      .from("payments")
      .update({ status: "paid", raw_payload: result.raw as never })
      .eq("reference", reference)
      .select("id");
    if (verifiedPayment?.[0]) {
      await recordPaymentEvent(verifiedPayment[0].id, PAYMENT_EVENTS.verified, `Verified at Paystack (${result.status})`);
    }

    await admin
      .from("orders")
      .update({ payment_status: "paid", order_status: "paid" })
      .eq("id", order.id);

    const confirmation = paymentConfirmedEmail({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      amountKobo: result.amountKobo,
    });
    void sendEmail({ to: order.customer_email, subject: confirmation.subject, html: confirmation.html });

    if (process.env.ADMIN_EMAIL) {
      const adminMail = adminPaymentSuccessEmail({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        amountKobo: result.amountKobo,
      });
      void sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: adminMail.subject,
      html: adminMail.html,
      replyTo: order.customer_email,
    });
    }

    return NextResponse.json({ ok: true, status: "success", orderNumber: order.order_number });
  }

  // failed / abandoned / processing — record but never mark as paid
  const notPaidPaymentStatus =
    result.status === "abandoned"
      ? "abandoned"
      : result.status === "failed" || result.status === "reversed"
      ? "failed"
      : "processing"; // paystack pending → still in flight

  const { data: notPaidPayment } = await admin
    .from("payments")
    .update({ status: notPaidPaymentStatus, raw_payload: result.raw as never })
    .eq("reference", reference)
    .select("id");

  if (notPaidPayment?.[0]) {
    const notPaidEvent =
      notPaidPaymentStatus === "abandoned"
        ? PAYMENT_EVENTS.abandoned
        : notPaidPaymentStatus === "failed"
        ? PAYMENT_EVENTS.failed
        : PAYMENT_EVENTS.verification_started;
    await recordPaymentEvent(
      notPaidPayment[0].id,
      notPaidEvent,
      `Paystack reported: ${result.status}`
    );
  }

  // Only move the order out of pending — never overwrite a later admin state
  const notPaidOrderStatus =
    notPaidPaymentStatus === "failed" ? "failed" : "pending";

  await admin
    .from("orders")
    .update({ payment_status: notPaidOrderStatus })
    .eq("id", order.id)
    .in("payment_status", ["pending", "processing"]);

  return NextResponse.json({ ok: true, status: result.status, orderNumber: order.order_number });
}
