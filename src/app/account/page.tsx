import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { isSupabaseConfigured } from "@/lib/catalog";
import { SetupNotice } from "@/components/shop/setup-notice";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus } from "@/types";
import { formatNGN } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "My Account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured) {
    return (
      <div className="container-page py-14">
        <h1 className="font-display text-3xl font-bold text-cocoa-900">My Account</h1>
        <div className="mt-10"><SetupNotice /></div>
      </div>
    );
  }

  const { error: pageError } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/account");

  const [profileRes, ordersRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("orders")
      .select("id, order_number, total, order_status, payment_status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const profile = profileRes.data;
  const orders = ordersRes.data ?? [];
  const isAdmin = profile?.role === "admin";

  return (
    <div className="container-page py-10">
      {pageError === "forbidden" && (
        <p role="alert" className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          You don&apos;t have permission to access the admin dashboard.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {profile?.avatar_url && (
            <Image
              src={profile.avatar_url}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-full border border-cocoa-100 object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <h1 className="font-display text-3xl font-bold text-cocoa-900">
              Hello{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
            </h1>
            <p className="mt-1 text-sm text-cocoa-500">{user.email}</p>
          </div>
        </div>

        <div className="flex gap-3">
          {isAdmin && (
            <Link href="/admin" className="btn-outline">Admin Dashboard</Link>
          )}
          <SignOutButton className="btn-ghost" />
        </div>
      </div>

      <section className="mt-10" aria-labelledby="orders-heading">
        <div className="flex items-center justify-between">
          <h2 id="orders-heading" className="font-display text-xl font-bold text-cocoa-900">Recent Orders</h2>
          <Link href="/orders" className="text-sm font-semibold text-blush-600 hover:text-blush-700">
            View all →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="card mt-4 p-8 text-center">
            <p className="font-medium text-cocoa-700">No orders yet</p>
            <p className="mt-1 text-sm text-cocoa-500">Your order history will appear here after your first order.</p>
            <Link href="/shop" className="btn-primary mt-4">Start Shopping</Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.order_number}`}
                  className="card flex flex-wrap items-center justify-between gap-3 p-4 transition-shadow hover:shadow-card-hover"
                >
                  <div>
                    <span className="font-semibold text-cocoa-900">{order.order_number}</span>
                    <span className="ml-3 text-xs text-cocoa-500">{formatDateTime(order.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge bg-cocoa-100 text-cocoa-700">
                      {ORDER_STATUS_LABELS[order.order_status as OrderStatus] ?? order.order_status}
                    </span>
                    <span
                      className={`badge ${
                        order.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
                    </span>
                    <span className="font-bold text-cocoa-900">{formatNGN(Math.round(order.total * 100))}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
