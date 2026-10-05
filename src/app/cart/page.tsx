"use client";

import Link from "next/link";

import { ResilientImage } from "@/components/ui/resilient-image";
import { useCart, useToast } from "@/components/providers";
import { formatNGN } from "@/lib/money";

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotal, clearCart, itemCount, hydrated } = useCart();
  const showToast = useToast();

  // Before localStorage is read on the client, render a skeleton to avoid a
  // flash of "empty cart" for customers with saved items.
  if (!hydrated) {
    return (
      <div className="container-page py-10">
        <h1 className="font-display text-3xl font-bold text-cocoa-900">Your Cart</h1>
        <div className="mt-8 grid gap-8 lg:grid-cols-3" aria-busy="true" aria-label="Loading cart">
          <div className="space-y-4 lg:col-span-2">
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
          </div>
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold text-cocoa-900">Your Cart</h1>
      <p className="mt-1 text-sm text-cocoa-500" aria-live="polite">
        {itemCount === 0 ? "Your cart is empty" : `${itemCount} item${itemCount === 1 ? "" : "s"} in your cart`}
      </p>

      {items.length === 0 ? (
        <div className="card mx-auto mt-10 max-w-md p-10 text-center">
          <div className="text-5xl" aria-hidden="true">🧁</div>
          <p className="mt-4 font-semibold text-cocoa-800">Nothing here yet!</p>
          <p className="mt-1 text-sm text-cocoa-500">Add something delicious to get started.</p>
          <Link href="/shop" className="btn-primary mt-6">Browse Treats</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* Items */}
          <ul className="space-y-4 lg:col-span-2">
            {items.map((item) => (
              <li key={item.key} className="flex gap-4 rounded-2xl bg-white p-4 shadow-card">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-cocoa-100">
                  <ResilientImage src={item.imageUrl} alt={item.name} fill className="object-cover object-top" sizes="96px" fallbackEmoji="🍰" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/product/${item.slug}`} className="font-semibold text-cocoa-900 hover:text-blush-600">
                      {item.name}
                    </Link>
                    <span className="font-bold text-cocoa-900">{formatNGN(item.unitPrice * item.quantity)}</span>
                  </div>
                  {item.options.length > 0 && (
                    <p className="mt-1 text-xs leading-snug text-cocoa-500">
                      {item.options.map((o) => `${o.optionName}: ${o.value}`).join(" · ")}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-cocoa-400">{formatNGN(item.unitPrice)} each</p>

                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center rounded-full border border-cocoa-200">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        aria-label={`Decrease quantity of ${item.name}`}
                        className="px-3 py-1.5 text-cocoa-700"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        aria-label={`Increase quantity of ${item.name}`}
                        className="px-3 py-1.5 text-cocoa-700"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="text-xs font-semibold text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  clearCart();
                  showToast("Cart cleared");
                }}
                className="text-xs font-semibold text-cocoa-400 hover:text-red-600"
              >
                Clear cart
              </button>
            </li>
          </ul>

          {/* Summary */}
          <aside className="h-fit rounded-2xl bg-white p-6 shadow-card lg:sticky lg:top-24" aria-label="Order summary">
            <h2 className="font-display text-lg font-bold text-cocoa-900">Order Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-cocoa-600">Subtotal</dt>
                <dd className="font-semibold text-cocoa-900">{formatNGN(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-cocoa-600">Delivery fee</dt>
                <dd className="text-cocoa-400">Calculated at checkout</dd>
              </div>
              <div className="flex justify-between border-t border-cocoa-100 pt-3 text-base">
                <dt className="font-bold text-cocoa-900">Estimated total</dt>
                <dd className="font-bold text-cocoa-900">{formatNGN(subtotal)}</dd>
              </div>
            </dl>
            <Link href="/checkout" className="btn-primary mt-6 w-full">
              Proceed to Checkout
            </Link>
            <Link href="/shop" className="btn-ghost mt-2 w-full">
              Continue Shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
