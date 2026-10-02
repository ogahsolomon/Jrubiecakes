import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/catalog";
import { SetupNotice } from "@/components/shop/setup-notice";
import { formatNGN } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus } from "@/types";

export const metadata: Metadata = { title: "My Orders" };

export default async function OrdersPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="container-page py-14">
        <h1 className="font-display text-3xl font-bold text-cocoa-900">My Orders</h1>
        <div className="mt-10"><SetupNotice /></div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/orders");

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, total, order_status, payment_status, created_at, fulfillment_type, requested_date")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold text-cocoa-900">My Orders</h1>
      <p className="mt-1 text-sm text-cocoa-500">Track and review all your Jrubiecakes orders</p>

      {!orders || orders.length === 0 ? (
        <div className="card mx-auto mt-10 max-w-md p-10 text-center">
          <div className="text-5xl" aria-hidden="true">📦</div>
          <p className="mt-4 font-semibold text-cocoa-800">No orders yet</p>
          <p className="mt-1 text-sm text-cocoa-500">Your orders will show up here.</p>
          <Link href="/shop" className="btn-primary mt-6">Start Shopping</Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.order_number}`}
                className="card flex flex-wrap items-center justify-between gap-4 p-5 transition-shadow hover:shadow-card-hover"
              >
                <div>
                  <div className="font-bold text-cocoa-900">{order.order_number}</div>
                  <div className="mt-0.5 text-xs text-cocoa-500">
                    Placed {formatDateTime(order.created_at)} ·{" "}
                    {order.fulfillment_type === "delivery" ? "Delivery" : "Pickup"}
                    {order.requested_date ? ` for ${order.requested_date}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                    {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
                  </span>
                  <span className="text-base font-bold text-cocoa-900">
                    {formatNGN(Math.round(order.total * 100))}
                  </span>
                  <span className="text-cocoa-400" aria-hidden="true">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
