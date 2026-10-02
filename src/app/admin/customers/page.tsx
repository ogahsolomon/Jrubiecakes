import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const admin = createAdminClient();

  const [profilesRes, ordersRes] = await Promise.all([
    admin.from("profiles").select("id, email, full_name, phone, role, created_at").order("created_at", { ascending: false }),
    admin.from("orders").select("user_id, customer_email, total, order_status").in("order_status", [
      "paid", "confirmed", "preparing", "ready", "out_for_delivery", "completed",
    ]),
  ]);

  const customers = profilesRes.data ?? [];
  const orders = ordersRes.data ?? [];

  // Aggregate order counts + spend per email
  const statsByEmail = new Map<string, { count: number; spend: number }>();
  for (const o of orders) {
    const email = (o as { customer_email: string }).customer_email;
    const cur = statsByEmail.get(email) ?? { count: 0, spend: 0 };
    cur.count += 1;
    cur.spend += Number((o as { total: number }).total);
    statsByEmail.set(email, cur);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-cocoa-900">Customers</h1>
      <p className="mt-1 text-sm text-cocoa-500">{customers.length} registered customer{customers.length === 1 ? "" : "s"}</p>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-cocoa-100 text-xs uppercase tracking-wide text-cocoa-400">
            <tr>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 text-right font-medium">Total spent</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-cocoa-400">
                  No registered customers yet.
                </td>
              </tr>
            )}
            {customers.map((c) => {
              const stats = statsByEmail.get(c.email);
              return (
                <tr key={c.id} className="border-b border-cocoa-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-cocoa-900">{c.full_name ?? "—"}</div>
                    <div className="text-xs text-cocoa-400">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 text-cocoa-600">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-cocoa-100 text-cocoa-700">{stats?.count ?? 0}</span>
                    {c.role === "admin" && <span className="badge ml-1 bg-blush-100 text-blush-700">Admin</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-cocoa-900">
                    {stats ? `₦${stats.spend.toLocaleString("en-NG")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-cocoa-500">{formatDateTime(c.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
