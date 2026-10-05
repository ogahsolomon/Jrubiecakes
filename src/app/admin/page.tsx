import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatNGN } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/types";

export const dynamic = "force-dynamic";

function MetricCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card p-5 ${accent ? "bg-cocoa-800" : ""}`}>
      <div className={`text-xs font-medium uppercase tracking-wide ${accent ? "text-cocoa-300" : "text-cocoa-400"}`}>
        {label}
      </div>
      <div className={`mt-1.5 font-display text-2xl font-bold ${accent ? "text-cream-50" : "text-cocoa-900"}`}>
        {value}
      </div>
      {hint && <div className={`mt-1 text-xs ${accent ? "text-cocoa-300" : "text-cocoa-400"}`}>{hint}</div>}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const admin = createAdminClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todayOrders, pendingOrders, awaitingPayment, totalCustomers, recentOrders, allPaidOrders] =
    await Promise.all([
      admin
        .from("orders")
        .select("total", { count: "exact" })
        .gte("created_at", startOfToday.toISOString()),
      admin.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "pending"),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("order_status", ["awaiting_payment"])
        .eq("payment_status", "awaiting_payment"),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
      admin
        .from("orders")
        .select("id, order_number, customer_name, total, order_status, payment_status, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      admin.from("orders").select("total, order_items (product_name, quantity)").in("order_status", [
        "paid",
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
        "completed",
      ]),
    ]);

  const todayRevenue = (todayOrders.data ?? []).reduce((sum, o) => sum + Number(o.total), 0);

  // Best sellers: aggregate quantity per product name
  const counts = new Map<string, number>();
  for (const order of allPaidOrders.data ?? []) {
    for (const item of (order.order_items as { product_name: string; quantity: number }[] | null) ?? []) {
      counts.set(item.product_name, (counts.get(item.product_name) ?? 0) + item.quantity);
    }
  }
  const bestSellers = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-cocoa-900">Dashboard</h1>
      <p className="mt-1 text-sm text-cocoa-500">Today at a glance</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Today's orders"
          value={String(todayOrders.count ?? 0)}
          hint="Orders placed today"
          accent
        />
        <MetricCard
          label="Today's revenue"
          value={formatNGN(Math.round(todayRevenue * 100))}
          hint="All payment methods"
        />
        <MetricCard
          label="Pending orders"
          value={String(pendingOrders.count ?? 0)}
          hint="Need review"
        />
        <MetricCard
          label="Awaiting payment"
          value={String(awaitingPayment.count ?? 0)}
          hint="Bank transfers & unpaid"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <MetricCard label="Total customers" value={String(totalCustomers.count ?? 0)} />
        <MetricCard
          label="Paid orders (all time)"
          value={String((allPaidOrders.data ?? []).length)}
          hint="Excludes pending & cancelled"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="recent-orders">
          <div className="flex items-center justify-between">
            <h2 id="recent-orders" className="font-display text-lg font-bold text-cocoa-900">Recent orders</h2>
            <Link href="/admin/orders" className="text-xs font-semibold text-blush-600 hover:text-blush-700">
              View all →
            </Link>
          </div>
          <div className="card table-scroll mt-3">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-cocoa-100 text-xs uppercase tracking-wide text-cocoa-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(recentOrders.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-cocoa-400">
                      No orders yet — they&apos;ll show up here.
                    </td>
                  </tr>
                ) : (
                  (recentOrders.data ?? []).map((order) => (
                    <tr key={order.id} className="border-b border-cocoa-50 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${order.id}`} className="font-semibold text-cocoa-900 hover:text-blush-600">
                          {order.order_number}
                        </Link>
                        <div className="text-xs text-cocoa-400">{formatDateTime(order.created_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="truncate text-cocoa-700">{order.customer_name}</div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="badge bg-cocoa-100 text-cocoa-700">
                          {ORDER_STATUS_LABELS[order.order_status as OrderStatus] ?? order.order_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatNGN(Math.round(order.total * 100))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="best-sellers">
          <h2 id="best-sellers" className="font-display text-lg font-bold text-cocoa-900">Best sellers</h2>
          <div className="card mt-3 p-4">
            {bestSellers.length === 0 ? (
              <p className="py-6 text-center text-sm text-cocoa-400">Sales data will appear here.</p>
            ) : (
              <ol className="space-y-3">
                {bestSellers.map(([name, qty], i) => (
                  <li key={name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cocoa-100 text-xs font-bold text-cocoa-700">
                        {i + 1}
                      </span>
                      <span className="truncate text-cocoa-800">{name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-cocoa-500">{qty} sold</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
