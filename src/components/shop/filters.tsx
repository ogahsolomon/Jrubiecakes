"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";

export function ShopFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const activeCategory = searchParams.get("category") ?? "";
  const activeSort = searchParams.get("sort") ?? "newest";

  const apply = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.delete("page"); // reset pagination on filter change
      startTransition(() => {
        router.push(`/shop?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-4">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ search: search.trim() || null });
        }}
        className="flex gap-2"
      >
        <label htmlFor="shop-search" className="sr-only">
          Search products
        </label>
        <input
          id="shop-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cakes, pastries, cookies…"
          className="input flex-1"
        />
        <button type="submit" disabled={isPending} className="btn-primary shrink-0">
          {isPending ? "…" : "Search"}
        </button>
      </form>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button
            type="button"
            onClick={() => apply({ category: null })}
            aria-pressed={!activeCategory}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              !activeCategory ? "bg-cocoa-800 text-cream-50" : "bg-cocoa-100 text-cocoa-700 hover:bg-cocoa-200"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => apply({ category: cat.slug })}
              aria-pressed={activeCategory === cat.slug}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                activeCategory === cat.slug
                  ? "bg-cocoa-800 text-cream-50"
                  : "bg-cocoa-100 text-cocoa-700 hover:bg-cocoa-200"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="shrink-0">
          <label htmlFor="shop-sort" className="sr-only">
            Sort products
          </label>
          <select
            id="shop-sort"
            value={activeSort}
            onChange={(e) => apply({ sort: e.target.value })}
            className="input !w-auto !py-2 text-xs"
          >
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name_asc">Name: A–Z</option>
          </select>
        </div>
      </div>
    </div>
  );
}
