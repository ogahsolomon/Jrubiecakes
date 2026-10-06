import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/supabase/request-user";
import { checkoutSchema, cartItemSchema } from "@/lib/validation";
import { priceCartServerSide } from "@/lib/pricing";
import { generateOrderNumber } from "@/lib/utils";
import { nairaToKobo, formatNGN } from "@/lib/money";
import { sendEmail } from "@/lib/email";
import {
  orderConfirmationEmail,
  adminNewOrderEmail,
  bankTransferAwaitingEmail,
  adminBankTransferOrderEmail,
} from "@/lib/email-templates";
import { SITE } from "@/lib/constants";
import { getSiteSetting, type BankDetails } from "@/lib/catalog";
import { initializeTransaction } from "@/lib/paystack";
import { recordPaymentEvent, PAYMENT_EVENTS } from "@/lib/payment-events";

const bodySchema = z.object({
  checkout: checkoutSchema,
  cart: z.array(cartItemSchema).min(1, "Cart is empty").max(50),
  // Which client is placing the order. Decides where Paystack sends the
  // customer back to. The callback URL is always built server-side from this
  // flag — the client can never supply an arbitrary redirect target.
  platform: z.enum(["web", "app"]).default("web"),
});

export async function POST(request: NextRequest) {
  // ---- Parse & validate ----
  let parsed;
  try {
    const json = await request.json();
    parsed = bodySchema.safeParse(json);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Invalid checkout details", field: first?.path.join(".") },
      { status: 400 }
    );
  }

  const { checkout, cart, platform } = parsed.data;

// Deep link Paystack uses to hand the customer back to the native app.
// Must stay in step with `scheme` in the mobile app's app.json.
const APP_PAYMENT_CALLBACK_URL = "jrubiecakes://checkout/result";

// ---- Identify user (optional - guests can order) ----
  // Accepts a Supabase session cookie (web) or an Authorization: Bearer
  // access token (native app) so mobile orders attach to the same account.
  const authUser = await getRequestUser(request);
  const user = authUser ? { id: authUser.id } : null;
  if (
    authUser &&
    (!authUser.email ||
      checkout.customer.email.trim().toLowerCase() !== authUser.email.trim().toLowerCase())
  ) {
    return NextResponse.json(
      {
        error: authUser.email
          ? "Use the email address on your account for order updates."
          : "Your signed-in account needs an email address to place an order.",
        field: "checkout.customer.email",
      },
      { status: 400 }
    );
  }
  const customerEmail = authUser?.email ?? checkout.customer.email;

  // ---- Check payment method is enabled ----
  const paymentOptions = await getSiteSetting("payment_options", {
    paystack: true,
    bank_transfer: true,
    cash: true,
  });
  if (!paymentOptions[checkout.paymentMethod]) {
    return NextResponse.json(
      { error: `Payment method "${checkout.paymentMethod}" is currently unavailable` },
      { status: 400 }
    );
  }

  // ---- Recalculate everything from the database (never trust the client) ----
  const priced = await priceCartServerSide(
    cart.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      options: l.options.map((o) => ({
        optionId: o.optionId,
        valueId: o.valueId,
        textValue: o.textValue,
      })),
    })),
    checkout.delivery.fulfillmentType,
    checkout.delivery.state
  );

  if (priced.lines.length === 0) {
    return NextResponse.json(
      { error: priced.issues[0] ?? "Your cart items are no longer available" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const orderNumber = generateOrderNumber();
  const orderTotalNaira = priced.total / 100;

  const initialPaymentStatus =
    checkout.paymentMethod === "bank_transfer"
      ? "awaiting_payment"
      : checkout.paymentMethod === "cash"
      ? "pending"
      : "pending";

  const initialOrderStatus =
    checkout.paymentMethod === "bank_transfer" ? "awaiting_payment" : "pending";

  // ---- Create order ----
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: user?.id ?? null,
      customer_name: checkout.customer.fullName,
      customer_email: customerEmail,
      customer_phone: checkout.customer.phone,
      fulfillment_type: checkout.delivery.fulfillmentType,
      address_line: checkout.delivery.addressLine ?? null,
      city: checkout.delivery.city ?? null,
      state: checkout.delivery.state ?? null,
      landmark: checkout.delivery.landmark ?? null,
      delivery_instructions: checkout.delivery.deliveryInstructions ?? null,
      requested_date: checkout.orderDetails.requestedDate,
      requested_time: checkout.orderDetails.requestedTime ?? null,
      notes: checkout.orderDetails.notes ?? null,
      subtotal: priced.subtotal / 100,
      delivery_fee: priced.deliveryFee / 100,
      discount: 0,
      total: orderTotalNaira,
      payment_method: checkout.paymentMethod,
      payment_status: initialPaymentStatus,
      order_status: initialOrderStatus,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    console.error("[orders] insert failed:", orderError?.message);
    return NextResponse.json({ error: "Could not create your order. Please try again." }, { status: 500 });
  }

  // ---- Create order items + options ----
  for (const line of priced.lines) {
    const { data: item, error: itemError } = await admin
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: line.productId,
        product_name: line.productName,
        unit_price: line.unitPrice / 100,
        quantity: line.quantity,
        line_total: line.lineTotal / 100,
      })
      .select("id")
      .single();

    if (itemError || !item) {
      console.error("[orders] item insert failed:", itemError?.message);
      await admin.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Could not save your order items." }, { status: 500 });
    }

    if (line.options.length > 0) {
      const { error: optError } = await admin.from("order_item_options").insert(
        line.options.map((o) => ({
          order_item_id: item.id,
          option_name: o.optionName,
          option_value: o.value,
          price_delta: o.priceDelta / 100,
        }))
      );
      if (optError) {
        console.error("[orders] options insert failed:", optError.message);
      }
    }
  }

  // ---- Payment record ----
  let authorizationUrl: string | null = null;
  let paymentReference: string | null = null;

  if (checkout.paymentMethod === "paystack") {
    paymentReference = `${orderNumber}-${Date.now().toString(36).toUpperCase()}`;
    const init = await initializeTransaction({
      email: customerEmail,
      amountKobo: priced.total,
      reference: paymentReference,
      callbackUrl:
        platform === "app" ? APP_PAYMENT_CALLBACK_URL : `${SITE.url}/checkout/callback`,
      metadata: { orderNumber, orderId: order.id, customerName: checkout.customer.fullName },
    });

    if (!init.ok) {
      // Keep the order but surface the failure; customer can retry payment
      const { data: failedPayment } = await admin
        .from("payments")
        .insert({
          order_id: order.id,
          method: "paystack",
          status: "failed",
          amount: orderTotalNaira,
          reference: paymentReference,
        })
        .select("id")
        .single();
      if (failedPayment) {
        await recordPaymentEvent(failedPayment.id, PAYMENT_EVENTS.failed, `Initialization failed: ${init.error}`);
      }
      await admin.from("orders").update({ payment_reference: paymentReference }).eq("id", order.id);
      return NextResponse.json(
        { error: `Payment could not be initialized: ${init.error}`, orderNumber: order.order_number },
        { status: 502 }
      );
    }

    authorizationUrl = init.authorizationUrl;
    await admin.from("orders").update({ payment_reference: init.reference }).eq("id", order.id);
    const { data: newPayment } = await admin
      .from("payments")
      .insert({
        order_id: order.id,
        method: "paystack",
        status: "pending",
        amount: orderTotalNaira,
        reference: init.reference,
        paystack_authorization_url: init.authorizationUrl,
      })
      .select("id")
      .single();
    if (newPayment) {
      await recordPaymentEvent(newPayment.id, PAYMENT_EVENTS.initialized, "Paystack checkout opened");
    }
  } else {
    await admin.from("payments").insert({
      order_id: order.id,
      method: checkout.paymentMethod,
      status: checkout.paymentMethod === "bank_transfer" ? "awaiting_payment" : "pending",
      amount: orderTotalNaira,
    });
  }

  // ---- Emails (fire and forget; failures must not break the order) ----
  const bankDetails = await getSiteSetting<BankDetails>("bank_details", {
    bankName: "",
    accountNumber: "",
    accountName: "",
  });

  const confirmation = orderConfirmationEmail({
    orderNumber: order.order_number,
    customerName: checkout.customer.fullName,
    lines: priced.lines,
    subtotal: priced.subtotal,
    deliveryFee: priced.deliveryFee,
    total: priced.total,
    paymentMethod: checkout.paymentMethod,
    fulfillmentType: checkout.delivery.fulfillmentType,
    requestedDate: checkout.orderDetails.requestedDate,
    bankDetails:
      checkout.paymentMethod === "bank_transfer" && bankDetails.accountNumber ? bankDetails : null,
  });

  void sendEmail({
    to: customerEmail,
    subject: confirmation.subject,
    html: confirmation.html,
  });

  if (process.env.ADMIN_EMAIL) {
    const adminMail =
      checkout.paymentMethod === "bank_transfer"
        ? adminBankTransferOrderEmail({
            orderNumber: order.order_number,
            customerName: checkout.customer.fullName,
            customerPhone: checkout.customer.phone,
            lines: priced.lines,
            subtotal: priced.subtotal,
            deliveryFee: priced.deliveryFee,
            total: priced.total,
          })
        : adminNewOrderEmail({
            orderNumber: order.order_number,
            customerName: checkout.customer.fullName,
            customerPhone: checkout.customer.phone,
            lines: priced.lines,
            subtotal: priced.subtotal,
            deliveryFee: priced.deliveryFee,
            total: priced.total,
            paymentMethod: checkout.paymentMethod,
          });
    void sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: adminMail.subject,
      html: adminMail.html,
      replyTo: customerEmail,
    });
  }

  // Bank transfer: dedicated customer email with transfer instructions
  if (
    checkout.paymentMethod === "bank_transfer" &&
    bankDetails.accountNumber
  ) {
    const transferMail = bankTransferAwaitingEmail({
      orderNumber: order.order_number,
      customerName: checkout.customer.fullName,
      lines: priced.lines,
      subtotal: priced.subtotal,
      deliveryFee: priced.deliveryFee,
      total: priced.total,
      fulfillmentType: checkout.delivery.fulfillmentType,
      requestedDate: checkout.orderDetails.requestedDate,
      bankDetails,
    });
    void sendEmail({
      to: customerEmail,
      subject: transferMail.subject,
      html: transferMail.html,
    });
  }

return NextResponse.json({
    ok: true,
    orderNumber: order.order_number,
    total: priced.total,
    authorizationUrl,
    // Returned so the native app can confirm payment later if the browser
    // redirect never lands (user closed the tab, network dropped, etc).
    paymentReference,
    issues: priced.issues,
  });
}

// Avoid static analysis treating this as a GET-able route
export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

// Ensure formatNGN import is used (referenced in error paths in future edits)
void formatNGN;
void nairaToKobo;
