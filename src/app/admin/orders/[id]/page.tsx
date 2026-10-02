import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateOrderStatus, markPaymentStatus } from "@/lib/admin-actions";
import { formatNGN } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, PAYMENT_STATUS_LABELS, type Order, type OrderStatus } from "@/types";

import { PAYMENT_EVENT_META, type PaymentEventName } from "@/lib/payment-event-meta";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select(`
      *,
      order_items (
        id, product_name, unit_price, quantity, line_total,
        order_item_options (id, option_name, option_value, price_delta)
      ),
      payments (id, method, status, amount, reference, created_at)
    `)
    .eq("id", id)
    .single<Order>();

  if (!order) notFound();

  const items = order.order_items ?? [];
  const payments = order.payments ?? [];

  // Timeline events per payment (single query for all of this order's payments)
  const paymentIds = payments.map((p) => p.id);
  const { data: eventRows } = paymentIds.length
    ? await admin
        .from("payment_events")
        .select("id, payment_id, event, detail, created_at")
        .in("payment_id", paymentIds)
        .order("created_at", { ascending: true })
    : { data: [] };
  const eventsByPayment = new Map<string, typeof eventRows>();
  for (const e of eventRows ?? []) {
    const list = eventsByPayment.get(e.payment_id) ?? [];
    list.push(e);
    eventsByPayment.set(e.payment_id, list);
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-xs text-cocoa-500">
        <Link href="/admin/orders" className="hover:text-cocoa-700">Orders</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-cocoa-800">{order.order_number}</span>
      </nav>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-cocoa-900">{order.order_number}</h1>
        <span className="text-xs text-cocoa-400">Placed {formatDateTime(order.created_at)}</span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: items + customer */}
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5" aria-labelledby="items-heading">
            <h2 id="items-heading" className="font-display text-lg font-bold text-cocoa-900">Items</h2>
            <ul className="mt-3 divide-y divide-cocoa-50">
              {items.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-cocoa-900">{item.product_name}</p>
                      {item.order_item_options && item.order_item_options.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-cocoa-500">
                          {item.order_item_options.map((o) => (
                            <li key={o.id}>
                              <span className="font-medium text-cocoa-700">{o.option_name}:</span>{" "}
                              {o.option_value}
                              {o.price_delta > 0 && (
                                <span className="text-cocoa-400"> (+{formatNGN(Math.round(o.price_delta * 100))})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-1 text-xs text-cocoa-400">
                        {formatNGN(Math.round(item.unit_price * 100))} × {item.quantity}
                      </p>
                    </div>
                    <span className="font-bold text-cocoa-900">
                      {formatNGN(Math.round(item.line_total * 100))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-cocoa-100 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-cocoa-500">Subtotal</dt>
                <dd>{formatNGN(Math.round(order.subtotal * 100))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-cocoa-500">Delivery fee</dt>
                <dd>{formatNGN(Math.round(order.delivery_fee * 100))}</dd>
              </div>
              <div className="flex justify-between text-base font-bold text-cocoa-900">
                <dt>Total</dt>
                <dd>{formatNGN(Math.round(order.total * 100))}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-5" aria-labelledby="customer-heading">
            <h2 id="customer-heading" className="font-display text-lg font-bold text-cocoa-900">Customer</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-cocoa-500">Name</dt>
                <dd className="font-medium text-cocoa-900">{order.customer_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-cocoa-500">Email</dt>
                <dd><a className="text-blush-600 hover:underline" href={`mailto:${order.customer_email}`}>{order.customer_email}</a></dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-cocoa-500">Phone</dt>
                <dd><a className="text-blush-600 hover:underline" href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-cocoa-500">Fulfilment</dt>
                <dd className="capitalize">{order.fulfillment_type}</dd>
              </div>
              {order.fulfillment_type === "delivery" && (
                <div className="flex justify-between gap-4">
                  <dt className="text-cocoa-500">Address</dt>
                  <dd className="max-w-[60%] text-right">
                    {order.address_line}, {order.city}, {order.state}
                    {order.landmark ? ` (${order.landmark})` : ""}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-cocoa-500">Requested</dt>
                <dd>{order.requested_date ?? "—"}{order.requested_time ? ` at ${order.requested_time}` : ""}</dd>
              </div>
              {order.delivery_instructions && (
                <div className="flex justify-between gap-4">
                  <dt className="text-cocoa-500">Delivery notes</dt>
                  <dd className="max-w-[60%] text-right">{order.delivery_instructions}</dd>
                </div>
              )}
              {order.notes && (
                <div className="flex justify-between gap-4">
                  <dt className="text-cocoa-500">Order notes</dt>
                  <dd className="max-w-[60%] text-right">{order.notes}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        {/* Right: status controls + payments */}
        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="status-heading">
            <h2 id="status-heading" className="font-display text-lg font-bold text-cocoa-900">Order status</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="badge bg-cocoa-100 text-cocoa-700">
                {ORDER_STATUS_LABELS[order.order_status as OrderStatus] ?? order.order_status}
              </span>
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

            <form action={updateOrderStatus} className="mt-4 space-y-3">
              <input type="hidden" name="orderId" value={order.id} />
              <div>
                <label htmlFor="status" className="label">Change status to</label>
                <select id="status" name="status" defaultValue={order.order_status} className="input">
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-cocoa-700">
                <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 rounded border-cocoa-300" />
                Email the customer about this update
              </label>
              <button type="submit" className="btn-primary w-full">Update Status</button>
            </form>
          </section>

          <section className="card p-5" aria-labelledby="payments-heading">
            <h2 id="payments-heading" className="font-display text-lg font-bold text-cocoa-900">Payments</h2>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-cocoa-400">No payment records.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {payments.map((p) => (
                  <li key={p.id} className="rounded-xl bg-cream-100 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold capitalize text-cocoa-900">{p.method.replace("_", " ")}</span>
                      <span className="font-bold">{formatNGN(Math.round(p.amount * 100))}</span>
                    </div>
                    <div className="mt-1 text-xs text-cocoa-500">
                      Status: {PAYMENT_STATUS_LABELS[p.status] ?? p.status} · {formatDateTime(p.created_at)}
                    </div>
                    {p.reference && <div className="mt-0.5 break-all text-[11px] text-cocoa-400">Ref: {p.reference}</div>}

                    {(() => {
                      const events = eventsByPayment.get(p.id) ?? [];
                      if (events.length === 0) return null;
                      return (
                        <div className="mt-3 border-t border-cocoa-100 pt-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-cocoa-400">Timeline</p>
                          <ol className="mt-2 space-y-2.5">
                            {events.map((ev) => {
                              const meta = PAYMENT_EVENT_META[ev.event as PaymentEventName] ?? {
                                label: ev.event,
                                icon: "•",
                                className: "bg-cocoa-100 text-cocoa-700",
                              };
                              return (
                                <li key={ev.id} className="flex gap-2.5">
                                  <span
                                    aria-hidden="true"
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${meta.className}`}
                                  >
                                    {meta.icon}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-cocoa-800">{meta.label}</p>
                                    {ev.detail && (
                                      <p className="break-words text-[11px] leading-snug text-cocoa-500">{ev.detail}</p>
                                    )}
                                    <p className="text-[10px] text-cocoa-400">{formatDateTime(ev.created_at)}</p>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      );
                    })()}

                    <form action={markPaymentStatus} className="mt-3 flex gap-2">
                      <input type="hidden" name="paymentId" value={p.id} />
                      <select name="status" defaultValue={p.status} className="input !py-2 text-xs" aria-label="Payment status">
                        <option value="pending">Pending</option>
                        <option value="awaiting_payment">Awaiting payment</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                      </select>
                      <button type="submit" className="btn-outline shrink-0 !px-3 !py-2 !text-xs">Save</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[11px] leading-relaxed text-cocoa-400">
              Bank transfer and cash payments must be marked manually after the money is received.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
