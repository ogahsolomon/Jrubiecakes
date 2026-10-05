import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/catalog";

export const metadata: Metadata = { title: "Admin Dashboard" };

  const NAV = [
    { href: "/admin", label: "Overview", icon: "📊" },
    { href: "/admin/orders", label: "Orders", icon: "🧾" },
    { href: "/admin/products", label: "Products", icon: "🧁" },
    { href: "/admin/categories", label: "Categories", icon: "📂" },
    { href: "/admin/customers", label: "Customers", icon: "👥" },
    { href: "/admin/reviews", label: "Reviews", icon: "⭐" },
    { href: "/admin/payments", label: "Payments", icon: "💳" },
    { href: "/admin/settings", label: "Settings", icon: "⚙️" },
  ];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    redirect("/account");
  }

  // Authoritative check (middleware also guards, but never rely on it alone)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/account?error=forbidden");

  return (
    <div className="container-page py-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <div className="rounded-2xl bg-cocoa-800 p-4 lg:sticky lg:top-24">
            <div className="px-2 pb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-cocoa-300">Admin</div>
              <div className="mt-1 truncate text-sm font-bold text-cream-50">
                {profile?.full_name ?? user.email}
              </div>
            </div>
            <nav
              aria-label="Admin navigation"
              className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-cream-100 hover:bg-cocoa-700"
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              <Link
                href="/"
                className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-cocoa-300 hover:bg-cocoa-700"
              >
                <span aria-hidden="true">🏠</span>
                View store
              </Link>
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
