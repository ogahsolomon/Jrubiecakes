"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/providers";
import type { CartItem } from "@/types";

/**
 * Synchronizes the local cart with Supabase for signed-in customers:
 * - pulls the saved cart once after sign-in and merges it with the local one
 * - pushes local cart changes to the server (debounced)
 *
 * Guest carts keep working purely from localStorage; sync simply adds a
 * server-side copy so a customer sees their cart on another device.
 */
export function useCartSync() {
  const { items, hydrated } = useCart();
  const pulledRef = useRef(false);
  const lastSyncedRef = useRef<string>("");
  const mergeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef<CartItem[]>(items);
  itemsRef.current = items;

  // Pull saved cart once per session, after local hydration
  useEffect(() => {
    if (!hydrated || pulledRef.current) return;
    pulledRef.current = true;

    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch("/api/cart", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const serverItems: CartItem[] = Array.isArray(data?.items) ? data.items : [];
        if (serverItems.length === 0) return;

        // Defer the merge so it runs after the local cart has settled
        mergeTimer.current = setTimeout(() => {
          const local = itemsRef.current;
          const byKey = new Map(local.map((i) => [i.key, i]));
          const merged: CartItem[] = [...local];

          for (const s of serverItems) {
            const existing = byKey.get(s.key);
            if (!existing) {
              merged.push(s); // server-only line (e.g. added on another device)
            } else if (s.quantity > existing.quantity) {
              const idx = merged.findIndex((m) => m.key === s.key);
              if (idx >= 0) merged[idx] = { ...existing, quantity: s.quantity };
            }
          }

          if (merged.length !== local.length || merged.some((m, i) => m !== local[i])) {
            // Replace through the public API is not available; write storage
            // directly so the next Providers render picks it up on reload.
            // Simplest robust approach: dispatch a custom event Providers listens to.
            window.dispatchEvent(
              new CustomEvent("jrubiecakes:merge-cart", { detail: merged })
            );
          }
        }, 0);
      } catch {
        // sync is best-effort
      }
    })();
  }, [hydrated]);

  // Push cart changes (debounced) when signed in
  useEffect(() => {
    if (!hydrated) return;

    const snapshot = JSON.stringify(items);
    if (snapshot === lastSyncedRef.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);

    pushTimer.current = setTimeout(async () => {
      lastSyncedRef.current = snapshot;
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; // guest — nothing to sync

        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
      } catch {
        // best-effort
      }
    }, 600);

    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [items, hydrated]);
}
