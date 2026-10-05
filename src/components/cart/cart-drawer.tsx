"use client";

import Link from "next/link";

import { useCart } from "@/components/providers";
import { ResilientImage } from "@/components/ui/resilient-image";
import { formatNGN } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CartDrawer() {
  const { items, isDrawerOpen, closeDrawer, updateQuantity, removeItem, subtotal, itemCount } = useCart();

  return (
    <div
      className={cn("fixed inset-0 z-50", isDrawerOpen ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!isDrawerOpen}
    >
      {/* Backdrop */}
      <div
        className={cn("absolute inset-0 bg-cocoa-900/40 transition-opacity", isDrawerOpen ? "opacity-100" : "opacity-0")}
        onClick={closeDrawer}
      />

      {/* Panel — full-width sheet on small screens, 28rem on larger ones */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col bg-cream-50 shadow-2xl transition-transform duration-300 sm:max-w-md",
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-cocoa-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-cocoa-900">Your Cart ({itemCount})</h2>
          <button type="button" onClick={closeDrawer} aria-label="Close cart" className="rounded-full p-2 hover:bg-cocoa-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="text-5xl" aria-hidden="true">🧁</div>
            <p className="font-medium text-cocoa-700">Your cart is empty</p>
            <p className="text-sm text-cocoa-500">Add something delicious to get started!</p>
            <Link href="/shop" onClick={closeDrawer} className="btn-primary mt-2">
              Browse Treats
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {items.map((item) => (
                <li key={item.key} className="flex gap-3 rounded-2xl bg-white p-3 shadow-card">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cocoa-100">
                    <ResilientImage src={item.imageUrl} alt={item.name} fill className="object-cover object-top" sizes="80px" fallbackEmoji="🍰" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/product/${item.slug}`} onClick={closeDrawer} className="text-sm font-semibold text-cocoa-900 hover:text-blush-600">
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        aria-label={`Remove ${item.name} from cart`}
                        className="shrink-0 rounded p-1 text-cocoa-400 hover:text-red-600"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {item.options.length > 0 && (
                      <p className="mt-0.5 text-xs leading-snug text-cocoa-500">
                        {item.options.map((o) => `${o.optionName}: ${o.value}`).join(" · ")}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-cocoa-200">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="px-3 py-2 text-cocoa-700 hover:text-cocoa-900" /* larger touch target on mobile */
                        >
                          −
                        </button>
                        <span aria-live="polite" className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="px-3 py-2 text-cocoa-700 hover:text-cocoa-900"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-bold text-cocoa-900">{formatNGN(item.unitPrice * item.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-cocoa-100 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-cocoa-600">Subtotal</span>
                <span className="text-lg font-bold text-cocoa-900">{formatNGN(subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-cocoa-500">Delivery fee calculated at checkout</p>
              <Link href="/checkout" onClick={closeDrawer} className="btn-primary mt-3 w-full">
                Proceed to Checkout
              </Link>
              <Link href="/cart" onClick={closeDrawer} className="btn-ghost mt-2 w-full">
                View Full Cart
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
