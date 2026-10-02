import { formatNGN } from "./money";
import { SITE } from "./constants";
import { escapeHtml } from "./mailgun";
import type { PricedLine } from "./pricing";

const BRAND_BG = "#FDF8EF";
const BRAND_DARK = "#452A1D";
const BRAND_ACCENT = "#C95A82";

export function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${BRAND_BG};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:${BRAND_DARK};padding:24px 32px;text-align:center;">
          <div style="color:#FDF8EF;font-size:22px;font-weight:bold;letter-spacing:1px;">Jrubiecakes</div>
          <div style="color:#ECABC0;font-size:12px;margin-top:4px;">Home of Yummy Tasty Cakes, Snacks &amp; Finger Foods</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_DARK};">${escapeHtml(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="background:${BRAND_BG};padding:20px 32px;text-align:center;color:#9C6248;font-size:12px;">
          ${escapeHtml(SITE.name)} · ${escapeHtml(SITE.phone)} · <a href="${SITE.url}" style="color:${BRAND_ACCENT};">${SITE.url.replace(/^https?:\/\//, "")}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function itemsTable(lines: PricedLine[], subtotal: number, deliveryFee: number, total: number): string {
  const rows = lines
    .map(
      (l) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #F0E1C8;color:#452A1D;">
          <strong>${escapeHtml(l.productName)}</strong> × ${l.quantity}
          ${l.options.length ? `<br/><span style="color:#9C6248;font-size:12px;">${l.options.map((o) => `${escapeHtml(o.optionName)}: ${escapeHtml(o.value)}`).join(" · ")}</span>` : ""}
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #F0E1C8;color:#452A1D;white-space:nowrap;">${formatNGN(l.lineTotal)}</td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    ${rows}
    <tr><td style="padding:8px 0;color:#7E4A33;">Subtotal</td><td align="right" style="padding:8px 0;color:#452A1D;">${formatNGN(subtotal)}</td></tr>
    <tr><td style="padding:8px 0;color:#7E4A33;">Delivery fee</td><td align="right" style="padding:8px 0;color:#452A1D;">${formatNGN(deliveryFee)}</td></tr>
    <tr><td style="padding:12px 0;font-weight:bold;color:#452A1D;border-top:2px solid #452A1D;">Total</td>
        <td align="right" style="padding:12px 0;font-weight:bold;color:#452A1D;border-top:2px solid #452A1D;">${formatNGN(total)}</td></tr>
  </table>`;
}

/** Branded CTA linking to the order tracking page (/orders/[orderNumber]). */
function viewOrderButton(orderNumber: string): string {
  const href = `${SITE.url}/orders/${encodeURIComponent(orderNumber)}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto 4px;"><tr><td style="background:${BRAND_ACCENT};border-radius:9999px;">
    <a href="${href}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-weight:bold;font-size:14px;text-decoration:none;">View your order</a>
  </td></tr></table>`;
}

function infoGrid(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;background:#FDF8EF;border-radius:12px;">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:8px 16px;color:#9C6248;font-size:13px;width:140px;">${escapeHtml(k)}</td><td style="padding:8px 16px;color:#452A1D;font-size:13px;">${escapeHtml(v)}</td></tr>`
      )
      .join("")}
  </table>`;
}

export function orderConfirmationEmail(params: {
  orderNumber: string;
  customerName: string;
  lines: PricedLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  fulfillmentType: string;
  requestedDate?: string | null;
  bankDetails?: { bankName: string; accountNumber: string; accountName: string } | null;
}) {
  const paymentLine =
    params.paymentMethod === "bank_transfer" && params.bankDetails
      ? `<p style="color:#452A1D;line-height:1.6;">Please transfer <strong>${formatNGN(params.total)}</strong> to:<br/>
         <strong>Bank:</strong> ${escapeHtml(params.bankDetails.bankName)}<br/>
         <strong>Account number:</strong> ${escapeHtml(params.bankDetails.accountNumber)}<br/>
         <strong>Account name:</strong> ${escapeHtml(params.bankDetails.accountName)}<br/>
         <span style="color:#9C6248;font-size:13px;">Use your order number <strong>${escapeHtml(params.orderNumber)}</strong> as the transfer narration.</span></p>`
      : params.paymentMethod === "cash"
      ? `<p style="color:#452A1D;">You chose to pay cash on delivery/pickup. Please have <strong>${formatNGN(params.total)}</strong> ready.</p>`
      : `<p style="color:#452A1D;">Complete your payment securely via Paystack using the link in your order page. Your order is reserved.</p>`;

  return {
    subject: `Order ${params.orderNumber} received — Jrubiecakes`,
    html: layout(
      `Thank you, ${params.customerName}!`,
      `<p style="color:#452A1D;line-height:1.6;">We've received your order <strong>${escapeHtml(params.orderNumber)}</strong> and it's now ${
        params.paymentMethod === "paystack" ? "awaiting payment" : "being reviewed"
      }.</p>
      ${itemsTable(params.lines, params.subtotal, params.deliveryFee, params.total)}
      ${infoGrid([
        ["Payment method", params.paymentMethod.replace("_", " ")],
        ["Fulfilment", params.fulfillmentType === "delivery" ? "Delivery" : "Pickup"],
        ["Requested date", params.requestedDate ?? "—"],
      ])}
      ${paymentLine}
      ${viewOrderButton(params.orderNumber)}`
    ),
  };
}

export function adminNewOrderEmail(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  lines: PricedLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
}) {
  return {
    subject: `🔔 New order ${params.orderNumber} — ${formatNGN(params.total)}`,
    html: layout(
      "New order received",
      `<p style="color:#452A1D;">${escapeHtml(params.customerName)} (${escapeHtml(params.customerPhone)}) placed order <strong>${escapeHtml(params.orderNumber)}</strong> via ${escapeHtml(params.paymentMethod.replace("_", " "))}.</p>
      ${itemsTable(params.lines, params.subtotal, params.deliveryFee, params.total)}`
    ),
  };
}

export function paymentConfirmedEmail(params: {
  orderNumber: string;
  customerName: string;
  amountKobo: number;
}) {
  return {
    subject: `Payment confirmed for ${params.orderNumber} — Jrubiecakes`,
    html: layout(
      "Payment received 💛",
      `<p style="color:#452A1D;line-height:1.6;">Hi ${escapeHtml(params.customerName)}, we've confirmed your payment of <strong>${formatNGN(params.amountKobo)}</strong> for order <strong>${escapeHtml(params.orderNumber)}</strong>.</p>
      <p style="color:#452A1D;line-height:1.6;">Your order is now confirmed and will go into preparation. We'll notify you when it's ready!</p>
      ${viewOrderButton(params.orderNumber)}`
    ),
  };
}

/** Friendly status note per order status — shared by all senders. */
export const ORDER_STATUS_EMAIL_NOTES: Record<string, string> = {
  pending: "Pending review",
  awaiting_payment: "Awaiting payment",
  paid: "Payment confirmed",
  confirmed: "Order confirmed",
  preparing: "Now baking",
  ready: "Ready for pickup/delivery",
  out_for_delivery: "Out for delivery",
  completed: "Delivered — enjoy!",
  cancelled: "Order cancelled",
};

export function orderStatusUpdateEmail(params: {
  orderNumber: string;
  customerName: string;
  status: string;
  statusNote: string;
  // Optional order details — included when provided
  lines?: PricedLine[];
  subtotal?: number;
  deliveryFee?: number;
  total?: number;
  paymentMethod?: string;
  fulfillmentType?: string;
  requestedDate?: string | null;
}) {
  const details =
    params.lines && params.lines.length > 0
      ? `${itemsTable(
          params.lines,
          params.subtotal ?? 0,
          params.deliveryFee ?? 0,
          params.total ?? 0
        )}
      ${infoGrid([
        ["Payment method", (params.paymentMethod ?? "").replace("_", " ") || "—"],
        ["Fulfilment", params.fulfillmentType === "delivery" ? "Delivery" : "Pickup"],
        ["Requested date", params.requestedDate ?? "—"],
      ])}`
      : "";

  return {
    subject: `Order ${params.orderNumber} — ${params.statusNote}`,
    html: layout(
      `Order update: ${params.statusNote}`,
      `<p style="color:#452A1D;line-height:1.6;">Hi ${escapeHtml(params.customerName)}, the status of your order <strong>${escapeHtml(params.orderNumber)}</strong> changed to <strong>${escapeHtml(params.statusNote)}</strong>.</p>
      ${details}
      ${viewOrderButton(params.orderNumber)}`
    ),
  };
}

/** Customer: bank transfer placed — awaiting admin confirmation. */
export function bankTransferAwaitingEmail(params: {
  orderNumber: string;
  customerName: string;
  lines: PricedLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  fulfillmentType: string;
  requestedDate?: string | null;
  bankDetails: { bankName: string; accountNumber: string; accountName: string };
}) {
  return {
    subject: `Bank transfer instructions for order ${params.orderNumber} — Jrubiecakes`,
    html: layout(
      `Almost there, ${params.customerName}!`,
      `<p style="color:#452A1D;line-height:1.6;">We've received your order <strong>${escapeHtml(params.orderNumber)}</strong> and it's <strong>awaiting payment</strong>. Please transfer <strong>${formatNGN(params.total)}</strong> to:</p>
      ${infoGrid([
        ["Bank", params.bankDetails.bankName],
        ["Account number", params.bankDetails.accountNumber],
        ["Account name", params.bankDetails.accountName],
        ["Narration", `Order ${params.orderNumber}`],
      ])}
      ${itemsTable(params.lines, params.subtotal, params.deliveryFee, params.total)}
      ${infoGrid([
        ["Fulfilment", params.fulfillmentType === "delivery" ? "Delivery" : "Pickup"],
        ["Requested date", params.requestedDate ?? "—"],
      ])}
      <p style="color:#9C6248;font-size:13px;">Once we confirm your transfer, we'll email you and start preparing your order. Your order number is <strong>${escapeHtml(params.orderNumber)}</strong> — keep it handy.</p>
      ${viewOrderButton(params.orderNumber)}`
    ),
  };
}

/** Admin: a bank transfer order was placed and needs confirmation. */
export function adminBankTransferOrderEmail(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  lines: PricedLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}) {
  return {
    subject: `🏦 Bank transfer awaiting confirmation — ${params.orderNumber} (${formatNGN(params.total)})`,
    html: layout(
      "Bank transfer awaiting confirmation",
      `<p style="color:#452A1D;">${escapeHtml(params.customerName)} (${escapeHtml(params.customerPhone)}) placed order <strong>${escapeHtml(params.orderNumber)}</strong> by <strong>bank transfer</strong>. Confirm the transfer in the admin dashboard to start preparation.</p>
      ${itemsTable(params.lines, params.subtotal, params.deliveryFee, params.total)}`
    ),
  };
}

/** Admin: a Paystack payment was successfully verified. */
export function adminPaymentSuccessEmail(params: {
  orderNumber: string;
  customerName: string;
  amountKobo: number;
}) {
  return {
    subject: `💰 Payment received — ${params.orderNumber} (${formatNGN(params.amountKobo)})`,
    html: layout(
      "Payment received",
      `<p style="color:#452A1D;">Paystack payment of <strong>${formatNGN(params.amountKobo)}</strong> verified for order <strong>${escapeHtml(params.orderNumber)}</strong> from ${escapeHtml(params.customerName)}. The order is marked paid and ready for preparation.</p>`
    ),
  };
}
