import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const admin = createAdminClient();
  const { data: categories } = await admin
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="max-w-3xl">
      <nav aria-label="Breadcrumb" className="text-xs text-cocoa-500">
        <Link href="/admin/products" className="hover:text-cocoa-700">Products</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-cocoa-800">New</span>
      </nav>
      <h1 className="mt-2 font-display text-2xl font-bold text-cocoa-900">Add Product</h1>

      <div className="card mt-6 p-6">
        <ProductForm categories={categories ?? []} />
      </div>
    </div>
  );
}
