import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getCategories, getProducts, isSupabaseConfigured } from "@/lib/catalog";
import { ProductCard } from "@/components/shop/product-card";
import { ProductGridSkeleton } from "@/components/shop/skeletons";
import { SetupNotice } from "@/components/shop/setup-notice";
import { ShopFilters } from "@/components/shop/filters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Shop All Cakes & Pastries",
  description:
    "Browse birthday cakes, children's cakes, cupcakes, donuts, chin chin, small chops and more — all freshly baked by Jrubiecakes.",
};

const PAGE_SIZE = 12;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Number(first(params.page) ?? "1") || 1;
  const category = first(params.category);
  const search = first(params.search);
  const sort = (first(params.sort) as "newest" | "price_asc" | "price_desc" | "name_asc") ?? "newest";

  const [categories, { products, total, error }] = await Promise.all([
    getCategories(),
    getProducts({ categorySlug: category, search, sort, page, pageSize: PAGE_SIZE }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCategory = categories.find((c) => c.slug === category);

  if (!isSupabaseConfigured) {
    return (
      <div className="container-page py-14">
        <h1 className="font-display text-3xl font-bold text-cocoa-900">Shop</h1>
        <div className="mt-10">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const buildPageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (category) sp.set("category", category);
    if (search) sp.set("search", search);
    if (sort !== "newest") sp.set("sort", sort);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/shop${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-cocoa-500">
        <Link href="/" className="hover:text-cocoa-700">Home</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-cocoa-800">{activeCategory ? activeCategory.name : "Shop"}</span>
      </nav>

      <h1 className="mt-2 font-display text-3xl font-bold text-cocoa-900">
        {activeCategory ? activeCategory.name : search ? `Results for “${search}”` : "Shop All Treats"}
      </h1>
      {activeCategory?.description && (
        <p className="mt-1 max-w-2xl text-sm text-cocoa-500">{activeCategory.description}</p>
      )}

      <div className="mt-6">
        <Suspense fallback={<div className="skeleton h-24 w-full" />}>
          <ShopFilters categories={categories} />
        </Suspense>
      </div>

      <p className="mt-6 text-xs text-cocoa-500" aria-live="polite">
        {error === "not_configured"
          ? ""
          : `${total} product${total === 1 ? "" : "s"}${totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}`}
      </p>

      {error && error !== "not_configured" ? (
        <div className="card mx-auto mt-6 max-w-lg p-6 text-center text-sm text-red-700">
          Something went wrong loading products. Please refresh the page.
        </div>
      ) : products.length === 0 ? (
        <div className="card mx-auto mt-6 max-w-lg p-8 text-center">
          <div className="text-4xl" aria-hidden="true">🔍</div>
          <p className="mt-3 font-semibold text-cocoa-800">No products found</p>
          <p className="mt-1 text-sm text-cocoa-500">
            {search || category ? "Try a different search or category." : "Products will appear here once seeded."}
          </p>
          {(search || category) && (
            <Link href="/shop" className="btn-outline mt-4">Clear filters</Link>
          )}
        </div>
      ) : (
        <Suspense fallback={<ProductGridSkeleton count={PAGE_SIZE} />}>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </Suspense>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={buildPageHref(page - 1)} className="btn-outline !px-4 !py-2 !text-xs" rel="prev">
              ← Previous
            </Link>
          )}
          <div className="flex gap-1.5">
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6));
              return start + i;
            })
              .filter((p) => p >= 1 && p <= totalPages)
              .map((p) => (
                <Link
                  key={p}
                  href={buildPageHref(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                    p === page ? "bg-cocoa-800 text-cream-50" : "bg-cocoa-100 text-cocoa-700 hover:bg-cocoa-200"
                  }`}
                >
                  {p}
                </Link>
              ))}
          </div>
          {page < totalPages && (
            <Link href={buildPageHref(page + 1)} className="btn-outline !px-4 !py-2 !text-xs" rel="next">
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
