import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { markPaymentStatus, expireStalePaymentsAction } from "@/lib/admin-actions";
import { formatNGN } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { PAYMENT_STATUS_LABELS } from "@/types";
import { ExpireStalePaymentsButton } from "@/components/admin/expire-stale-payments-button";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const admin = createAdminClient();
  const { data: payments } = await admin
    .from("payments")
    .select(`
      id, method, status, amount, reference, created_at,
      orders (id, order_number, customer_name)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-cocoa-900">Payments</h1>
          <p className="mt-1 text-sm text-cocoa-500">
            Paystack payments update automatically via webhook. Bank transfers &amp; cash need manual confirmation.
          </p>
        </div>
        <ExpireStalePaymentsButton />
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-cocoa-100 text-xs uppercase tracking-wide text-cocoa-400">
            <tr>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Update</th>
            </tr>
          </thead>
          <tbody>
            {(!payments || payments.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-cocoa-400">No payments recorded yet.</td>
              </tr>
            )}
            {payments?.map((p) => (
              <tr key={p.id} className="border-b border-cocoa-50 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${p.orders?.id ?? ""}`} className="font-semibold text-cocoa-900 hover:text-blush-600">
                    {p.orders?.order_number ?? "—"}
                  </Link>
                  <div className="text-xs text-cocoa-400">{p.orders?.customer_name}</div>
                </td>
                <td className="px-4 py-3 capitalize text-cocoa-700">{p.method.replace("_", " ")}</td>
                <td className="px-4 py-3 font-semibold">{formatNGN(Math.round(p.amount * 100))}</td>
                <td className="px-4 py-3">
                  <span
                    className={`badge ${
                      p.status === "paid"
                        ? "bg-green-100 text-green-800"
                        : p.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : p.status === "refunded"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                  </span>
                  {p.reference && (
                    <div className="mt-1 max-w-40 break-all text-[11px] text-cocoa-400">{p.reference}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-cocoa-500">{formatDateTime(p.created_at)}</td>
                <td className="px-4 py-3">
                  <form action={markPaymentStatus} className="flex justify-end gap-2">
                    <input type="hidden" name="paymentId" value={p.id} />
                    <select name="status" defaultValue={p.status} aria-label="Payment status" className="input !w-auto !py-1.5 text-xs">
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="awaiting_payment">Awaiting</option>
                      <option value="paid">Paid</option>
                      <option value="failed">Failed</option>
                      <option value="abandoned">Abandoned</option>
                      <option value="refunded">Refunded</option>
                    </select>
                    <button type="submit" className="btn-outline !px-3 !py-1.5 !text-xs">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
