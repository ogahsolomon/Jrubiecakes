"use client";

import Image from "next/image";
import { ResilientImage } from "@/components/ui/resilient-image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useCart, useToast } from "@/components/providers";
import { formatPriceNaira } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Product, ProductOption, CartItemOptionRef } from "@/types";

type Selection = Record<string, { valueId?: string; textValue?: string }>;

export function ProductDetail({ product }: { product: Product }) {
  const { addItem } = useCart();
  const showToast = useToast();
  const router = useRouter();

  const images = product.product_images ?? [];
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(product.min_order_quantity ?? 1);
  const [selection, setSelection] = useState<Selection>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const options: ProductOption[] = product.product_options ?? [];

  const optionsDelta = useMemo(() => {
    let delta = 0;
    for (const opt of options) {
      const sel = selection[opt.id];
      if (sel?.valueId) {
        const val = opt.product_option_values?.find((v) => v.id === sel.valueId);
        if (val) delta += val.price_delta;
      }
    }
    return delta;
  }, [options, selection]);

  const unitPrice = product.sale_price && product.sale_price < product.price ? product.sale_price : product.price;
  const totalPrice = (unitPrice + optionsDelta) * quantity;

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    for (const opt of options) {
      if (!opt.is_required) continue;
      const sel = selection[opt.id];
      const hasValue = opt.type === "select" ? !!sel?.valueId : !!sel?.textValue?.trim();
      if (!hasValue) nextErrors[opt.id] = `${opt.name} is required`;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildOptions() {
    return options
      .map((opt) => {
        const sel = selection[opt.id];
        if (!sel) return null;
        if (sel.valueId) {
          const val = opt.product_option_values?.find((v) => v.id === sel.valueId);
          if (!val) return null;
          return { optionName: opt.name, value: val.value, priceDelta: Math.round(val.price_delta * 100) };
        }
        if (sel.textValue?.trim()) {
          return { optionName: opt.name, value: sel.textValue.trim(), priceDelta: 0 };
        }
        return null;
      })
      .filter((x): x is { optionName: string; value: string; priceDelta: number } => x !== null);
  }

  function buildOptionRefs(): CartItemOptionRef[] {
    const refs: CartItemOptionRef[] = [];
    for (const opt of options) {
      const sel = selection[opt.id];
      if (!sel) continue;
      if (sel.valueId) {
        refs.push({ optionId: opt.id, valueId: sel.valueId });
      } else if (sel.textValue?.trim()) {
        refs.push({ optionId: opt.id, valueId: null, textValue: sel.textValue.trim() });
      }
    }
    return refs;
  }

  function handleAdd(buyNow = false) {
    if (!validate()) {
      showToast("Please complete the required options", "error");
      return;
    }
    setBusy(true);
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: images[0]?.url ?? null,
      unitPrice: Math.round((unitPrice + optionsDelta) * 100),
      quantity,
      options: buildOptions(),
      optionRefs: buildOptionRefs(),
    });
    showToast(`${product.name} added to cart`);
    if (buyNow) {
      router.push("/checkout");
    }
    setTimeout(() => setBusy(false), 400);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* ---------- Gallery ---------- */}
      <div>
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-cocoa-100 shadow-card">
          <ResilientImage
            src={images[activeImage]?.url}
            alt={images[activeImage]?.alt_text ?? product.name}
            fill
            priority
            className="object-cover object-top"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Product images">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                role="tab"
                aria-selected={i === activeImage}
                aria-label={`View image ${i + 1}`}
                onClick={() => setActiveImage(i)}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2",
                  i === activeImage ? "border-cocoa-700" : "border-transparent opacity-70 hover:opacity-100"
                )}
              >
                <ResilientImage src={img.url} alt="" fill className="object-cover object-top" sizes="64px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Info & options ---------- */}
      <div>
        {product.categories && (
          <span className="text-xs font-semibold uppercase tracking-wide text-cocoa-400">
            {product.categories.name}
          </span>
        )}
        <h1 className="mt-1 font-display text-3xl font-bold text-cocoa-900">{product.name}</h1>

        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-bold text-cocoa-900">{formatPriceNaira(unitPrice + optionsDelta)}</span>
          {product.sale_price && product.sale_price < product.price && (
            <span className="text-base text-cocoa-400 line-through">{formatPriceNaira(product.price)}</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {product.is_available ? (
            <span className="badge bg-green-100 text-green-800">✓ Available</span>
          ) : (
            <span className="badge bg-red-100 text-red-700">Unavailable</span>
          )}
          {product.prep_time_hours && (
            <span className="badge bg-cocoa-100 text-cocoa-700">Ready in ~{product.prep_time_hours}h</span>
          )}
          {product.min_order_quantity > 1 && (
            <span className="badge bg-cocoa-100 text-cocoa-700">Min. order: {product.min_order_quantity}</span>
          )}
        </div>

        {product.description && (
          <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-cocoa-600">
            {product.description}
          </p>
        )}

        {/* Options */}
        {options.length > 0 && (
          <div className="mt-6 space-y-5 rounded-2xl bg-cream-100 p-5">
            <h2 className="text-sm font-bold text-cocoa-900">
              {product.is_customizable ? "Customise your order" : "Choose your options"}
            </h2>
            {options.map((opt) => (
              <fieldset key={opt.id}>
                <legend className="label !mb-2">
                  {opt.name}
                  {opt.is_required && <span className="ml-1 text-blush-600" aria-hidden="true">*</span>}
                  {opt.is_required && <span className="sr-only">(required)</span>}
                </legend>

                {opt.type === "select" ? (
                  <div className="flex flex-wrap gap-2">
                    {opt.product_option_values?.map((val) => {
                      const selected = selection[opt.id]?.valueId === val.id;
                      return (
                        <button
                          key={val.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSelection((s) => ({ ...s, [opt.id]: { valueId: val.id } }));
                            setErrors((e) => ({ ...e, [opt.id]: "" }));
                          }}
                          className={cn(
                            "rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                            selected
                              ? "border-cocoa-800 bg-cocoa-800 text-cream-50"
                              : "border-cocoa-200 bg-white text-cocoa-700 hover:border-cocoa-400"
                          )}
                        >
                          {val.value}
                          {val.price_delta > 0 && (
                            <span className={cn("ml-1.5", selected ? "text-cream-200" : "text-cocoa-400")}>
                              +{formatPriceNaira(val.price_delta)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : opt.type === "multiline" ? (
                  <textarea
                    id={`opt-${opt.id}`}
                    rows={3}
                    className="input"
                    aria-invalid={!!errors[opt.id]}
                    placeholder={`Enter ${opt.name.toLowerCase()}…`}
                    value={selection[opt.id]?.textValue ?? ""}
                    onChange={(e) => {
                      setSelection((s) => ({ ...s, [opt.id]: { textValue: e.target.value } }));
                      setErrors((er) => ({ ...er, [opt.id]: "" }));
                    }}
                  />
                ) : (
                  <input
                    id={`opt-${opt.id}`}
                    type={opt.type === "date" ? "date" : "text"}
                    className="input"
                    aria-invalid={!!errors[opt.id]}
                    placeholder={`Enter ${opt.name.toLowerCase()}…`}
                    value={selection[opt.id]?.textValue ?? ""}
                    onChange={(e) => {
                      setSelection((s) => ({ ...s, [opt.id]: { textValue: e.target.value } }));
                      setErrors((er) => ({ ...er, [opt.id]: "" }));
                    }}
                  />
                )}

                {errors[opt.id] && (
                  <p role="alert" className="mt-1.5 text-xs text-red-600">
                    {errors[opt.id]}
                  </p>
                )}
              </fieldset>
            ))}
          </div>
        )}

        {/* Quantity + actions */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center rounded-full border border-cocoa-200 bg-white">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(product.min_order_quantity ?? 1, q - 1))}
              aria-label="Decrease quantity"
              className="px-4 py-3 text-cocoa-700 hover:text-cocoa-900"
            >
              −
            </button>
            <span aria-live="polite" className="min-w-8 text-center font-semibold">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              aria-label="Increase quantity"
              className="px-4 py-3 text-cocoa-700 hover:text-cocoa-900"
            >
              +
            </button>
          </div>
          <div className="text-sm text-cocoa-600">
            Total: <span className="font-bold text-cocoa-900">{formatPriceNaira(totalPrice)}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {product.is_customizable && product.slug !== "fully-custom-cake" && (
            <Link href="/custom-cake" className="btn-blush flex-1">
              Customize Cake
            </Link>
          )}
          <button
            type="button"
            onClick={() => handleAdd(false)}
            disabled={busy || !product.is_available}
            className="btn-primary flex-1"
          >
            {busy ? "Adding…" : "Add to Cart"}
          </button>
          <button
            type="button"
            onClick={() => handleAdd(true)}
            disabled={busy || !product.is_available}
            className="btn-blush flex-1"
          >
            Buy Now
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-cocoa-500">
          Need something different? Call or WhatsApp us — we love a challenge. Custom cakes need
          at least 48 hours&apos; notice.
        </p>
      </div>
    </div>
  );
}
