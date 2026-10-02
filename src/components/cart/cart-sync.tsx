"use client";

import { useCartSync } from "@/components/cart/use-cart-sync";

/** Mounted once in the root layout; no UI — keeps the cart in sync with Supabase. */
export function CartSync() {
  useCartSync();
  return null;
}
