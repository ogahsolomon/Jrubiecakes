"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart, useToast } from "@/components/providers";
import { effectivePrice, formatPriceNaira, isOnSale } from "@/lib/money";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const showToast = useToast();
  const [adding, setAdding] = useState(false);

  const price = effectivePrice(product.price, product.sale_price);
  const onSale = isOnSale(product.price, product.sale_price);
  const image = product.product_images?.[0];

  const handleAdd = () => {
    setAdding(true);
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: image?.url ?? null,
      unitPrice: Math.round(price * 100),
      quantity: product.min_order_quantity ?? 1,
      options: [],
    });
    showToast(`${product.name} added to cart`);
    setTimeout(() => setAdding(false), 400);
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-shadow hover:shadow-card-hover">
      <Link href={`/product/${product.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-cocoa-100">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt_text ?? product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl" aria-hidden="true">🎂</div>
        )}
        {onSale && (
          <span className="badge absolute left-3 top-3 bg-blush-500 text-white">Sale</span>
        )}
        {!product.is_available && (
          <span className="badge absolute left-3 top-3 bg-cocoa-800 text-cream-50">Sold out</span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {product.categories && (
          <span className="text-xs font-medium uppercase tracking-wide text-cocoa-400">
            {product.categories.name}
          </span>
        )}
        <Link href={`/product/${product.slug}`} className="mt-1 line-clamp-2 font-semibold text-cocoa-900 hover:text-blush-600">
          {product.name}
        </Link>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-lg font-bold ${onSale ? "text-blush-600" : "text-cocoa-900"}`}>
            {formatPriceNaira(price)}
          </span>
          {onSale && (
            <span className="text-sm text-cocoa-400 line-through">{formatPriceNaira(product.price)}</span>
          )}
        </div>

        <div className="mt-4 flex flex-1 items-end gap-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !product.is_available}
            className="btn-primary flex-1 !py-2.5 !text-xs"
          >
            {adding ? "Adding…" : "Add to Cart"}
          </button>
          <Link href={`/product/${product.slug}`} className="btn-outline !py-2.5 !text-xs">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}
