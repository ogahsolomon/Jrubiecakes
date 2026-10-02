import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { archiveProduct, deleteProduct } from "@/lib/admin-actions";
import { formatPriceNaira } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const admin = createAdminClient();

  let query = admin
    .from("products")
    .select(`
      id, name, slug, price, sale_price, is_available, is_featured, is_customizable,
      categories (name),
      product_images (url, sort_order)
    `)
    .order("name");

  if (!showArchived) query = query.eq("is_available", true);

  const { data: products } = await query;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-cocoa-900">Products</h1>
          <p className="mt-1 text-sm text-cocoa-500">Add, edit and manage your catalogue</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={showArchived ? "/admin/products" : "/admin/products?archived=1"}
            className="btn-outline !py-2.5"
          >
            {showArchived ? "Active products" : "Archived products"}
          </Link>
          <Link href="/admin/products/new" className="btn-primary !py-2.5">
            + Add Product
          </Link>
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-cocoa-100 text-xs uppercase tracking-wide text-cocoa-400">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!products || products.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-cocoa-400">
                  {showArchived ? "No archived products." : "No products yet — add your first product."}
                </td>
              </tr>
            )}
            {products?.map((p) => {
              const image = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
              return (
                <tr key={p.id} className="border-b border-cocoa-50 last:border-0 hover:bg-cream-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-cocoa-100">
                        {image?.url ? (
                          <Image src={image.url} alt="" fill className="object-cover" sizes="44px" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-lg" aria-hidden="true">🎂</div>
                        )}
                      </div>
                      <Link href={`/admin/products/${p.id}`} className="font-semibold text-cocoa-900 hover:text-blush-600">
                        {p.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-cocoa-600">{p.categories?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-cocoa-900">{formatPriceNaira(p.price)}</span>
                    {p.sale_price != null && p.sale_price < p.price && (
                      <span className="ml-1.5 text-xs text-blush-600">
                        Sale {formatPriceNaira(p.sale_price)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.is_featured && <span className="badge bg-blush-100 text-blush-700">Featured</span>}
                      {p.is_customizable && <span className="badge bg-cocoa-100 text-cocoa-600">Custom</span>}
                      {!p.is_available && <span className="badge bg-red-100 text-red-600">Archived</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/products/${p.id}`} className="btn-outline !px-3 !py-1.5 !text-xs">
                        Edit
                      </Link>
                      <form action={archiveProduct}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="archive" value={p.is_available ? "1" : "0"} />
                        <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs">
                          {p.is_available ? "Archive" : "Restore"}
                        </button>
                      </form>
                      {showArchived && (
                        <form action={deleteProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="btn-ghost !px-3 !py-1.5 !text-xs !text-red-600 hover:!bg-red-50"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
