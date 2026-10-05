import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatNGN } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, PAYMENT_STATUS_LABELS, type OrderStatus } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, total, order_status, payment_status, payment_method, fulfillment_type, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && ORDER_STATUSES.includes(status as OrderStatus)) {
    query = query.eq("order_status", status);
  }

  const { data: orders } = await query;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-cocoa-900">Orders</h1>
      <p className="mt-1 text-sm text-cocoa-500">Manage and track all customer orders</p>

      <nav aria-label="Filter orders by status" className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
            !status ? "bg-cocoa-800 text-cream-50" : "bg-cocoa-100 text-cocoa-700 hover:bg-cocoa-200"
          }`}
        >
          All
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              status === s ? "bg-cocoa-800 text-cream-50" : "bg-cocoa-100 text-cocoa-700 hover:bg-cocoa-200"
            }`}
          >
            {ORDER_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>

      <div className="card table-scroll mt-5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-cocoa-100 text-xs uppercase tracking-wide text-cocoa-400">
            <tr>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Fulfilment</th>
              <th className="px-4 py-3 font-medium">Order status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-cocoa-400">
                  No orders found{status ? " with this status" : ""}.
                </td>
              </tr>
            )}
            {orders?.map((order) => (
              <tr key={order.id} className="border-b border-cocoa-50 last:border-0 hover:bg-cream-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-semibold text-cocoa-900 hover:text-blush-600">
                    {order.order_number}
                  </Link>
                  <div className="text-xs text-cocoa-400">{formatDateTime(order.created_at)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-cocoa-800">{order.customer_name}</div>
                  <div className="text-xs text-cocoa-400">{order.customer_phone}</div>
                </td>
                <td className="px-4 py-3 text-cocoa-600 capitalize">{order.fulfillment_type}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-cocoa-100 text-cocoa-700">
                    {ORDER_STATUS_LABELS[order.order_status as OrderStatus] ?? order.order_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`badge ${
                      order.payment_status === "paid"
                        ? "bg-green-100 text-green-800"
                        : order.payment_status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
                  </span>
                  <div className="mt-1 text-[11px] capitalize text-cocoa-400">
                    {order.payment_method.replace("_", " ")}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatNGN(Math.round(order.total * 100))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
