import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatNGN } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type Order, type OrderStatus } from "@/types";

type Params = Promise<{ orderNumber: string }>;

export const metadata: Metadata = { title: "Order Details" };

const STATUS_FLOW: OrderStatus[] = [
  "paid",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
];

function StatusBadge({ status }: { status: string }) {
  const label = ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    awaiting_payment: "bg-amber-100 text-amber-800",
    paid: "bg-green-100 text-green-800",
    confirmed: "bg-blue-100 text-blue-800",
    preparing: "bg-blue-100 text-blue-800",
    ready: "bg-purple-100 text-purple-800",
    out_for_delivery: "bg-purple-100 text-purple-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-700",
  };
  return <span className={`badge ${styles[status] ?? "bg-cocoa-100 text-cocoa-700"}`}>{label}</span>;
}

export default async function OrderDetailPage({ params }: { params: Params }) {
  const { orderNumber } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/orders/${encodeURIComponent(orderNumber)}`);

  const { data: order } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (
        id, product_name, unit_price, quantity, line_total,
        order_item_options (id, option_name, option_value, price_delta)
      ),
      payments (id, method, status, amount, reference, created_at)
    `)
    .eq("order_number", decodeURIComponent(orderNumber))
    .single<Order>();

  if (!order || order.user_id !== user.id) notFound();

  const items = order.order_items ?? [];
  const payment = (order.payments ?? []).slice(-1)[0];

  return (
    <div className="container-page max-w-3xl py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-cocoa-500">
        <Link href="/orders" className="hover:text-cocoa-700">My Orders</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-cocoa-800">{order.order_number}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-cocoa-900">{order.order_number}</h1>
        <div className="flex gap-2">
          <StatusBadge status={order.order_status} />
          <span
            className={`badge ${
              order.payment_status === "paid"
                ? "bg-green-100 text-green-800"
                : order.payment_status === "failed"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            Payment: {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
          </span>
        </div>
      </div>

      {/* Progress flow */}
      {order.order_status !== "cancelled" && (
        <ol className="mt-6 flex flex-wrap gap-2" aria-label="Order progress">
          {STATUS_FLOW.map((s) => {
            const idx = STATUS_FLOW.indexOf(order.order_status as OrderStatus);
            const current = STATUS_FLOW.indexOf(s);
            const done = idx >= current && idx !== -1;
            return (
              <li
                key={s}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  done ? "bg-cocoa-700 text-cream-50" : "bg-cocoa-100 text-cocoa-400"
                }`}
              >
                {ORDER_STATUS_LABELS[s]}
              </li>
            );
          })}
        </ol>
      )}

      {/* Items */}
      <section className="mt-8" aria-label="Order items">
        <h2 className="font-display text-lg font-bold text-cocoa-900">Items</h2>
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-cocoa-900">{item.product_name}</p>
                  {item.order_item_options && item.order_item_options.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-cocoa-500">
                      {item.order_item_options.map((o) => (
                        <li key={o.id}>
                          {o.option_name}: <span className="text-cocoa-700">{o.option_value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-cocoa-400">
                    {formatNGN(Math.round(item.unit_price * 100))} × {item.quantity}
                  </p>
                </div>
                <span className="font-bold text-cocoa-900">{formatNGN(Math.round(item.line_total * 100))}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Totals */}
      <section className="card mt-6 p-5" aria-label="Order totals">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-cocoa-600">Subtotal</dt>
            <dd>{formatNGN(Math.round(order.subtotal * 100))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-cocoa-600">Delivery fee</dt>
            <dd>{formatNGN(Math.round(order.delivery_fee * 100))}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-cocoa-600">Discount</dt>
              <dd>−{formatNGN(Math.round(order.discount * 100))}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-cocoa-100 pt-2 text-base font-bold text-cocoa-900">
            <dt>Total</dt>
            <dd>{formatNGN(Math.round(order.total * 100))}</dd>
          </div>
        </dl>
      </section>

      {/* Details grid */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Order details">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-cocoa-900">
            {order.fulfillment_type === "delivery" ? "🛵 Delivery details" : "🏪 Pickup"}
          </h2>
          {order.fulfillment_type === "delivery" ? (
            <address className="mt-2 space-y-0.5 text-sm not-italic text-cocoa-600">
              <p>{order.address_line}</p>
              <p>{order.city}, {order.state}</p>
              {order.landmark && <p className="text-cocoa-500">Landmark: {order.landmark}</p>}
              {order.delivery_instructions && <p className="text-cocoa-500">{order.delivery_instructions}</p>}
            </address>
          ) : (
            <p className="mt-2 text-sm text-cocoa-600">
              We&apos;ll contact you with pickup details when your order is ready.
            </p>
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-bold text-cocoa-900">📅 Schedule</h2>
          <p className="mt-2 text-sm text-cocoa-600">
            Requested: {order.requested_date ?? "—"}
            {order.requested_time ? ` at ${order.requested_time}` : ""}
          </p>
          {order.notes && <p className="mt-2 text-xs text-cocoa-500">Notes: {order.notes}</p>}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-bold text-cocoa-900">💳 Payment</h2>
          <p className="mt-2 text-sm text-cocoa-600">
            Method: <span className="capitalize">{order.payment_method.replace("_", " ")}</span>
          </p>
          {payment?.reference && (
            <p className="mt-1 break-all text-xs text-cocoa-400">Ref: {payment.reference}</p>
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-bold text-cocoa-900">🕐 Timeline</h2>
          <p className="mt-2 text-sm text-cocoa-600">Placed: {formatDateTime(order.created_at)}</p>
          <p className="text-xs text-cocoa-500">Last update: {formatDateTime(order.updated_at)}</p>
        </div>
      </section>

      <div className="mt-8">
        <Link href="/shop" className="btn-outline">Continue Shopping</Link>
      </div>
    </div>
  );
}
