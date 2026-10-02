"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import type { CartItem, CartItemOption } from "@/types";

// ---------------- Cart ----------------

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number; // kobo
  /** True until localStorage has been read on the client. */
  hydrated: boolean;
  addItem: (item: Omit<CartItem, "key">) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within Providers");
  return ctx;
}

// ---------------- Toasts ----------------

type Toast = { id: number; message: string; kind: "success" | "error" | "info" };
const ToastContext = createContext<{ showToast: (message: string, kind?: Toast["kind"]) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within Providers");
  return ctx.showToast;
}

const STORAGE_KEY = "jrubiecakes-cart-v1";

function lineKey(productId: string, options: CartItemOption[]) {
  // Same product + same options (order-independent) = same line.
  // Different customizations stay separate cart items.
  return `${productId}::${options
    .map((o) => `${o.optionName}=${o.value}`)
    .sort()
    .join("|")}`;
}

export function Providers({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load cart from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed as CartItem[]);
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  // Persist cart on change (debounced)
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch {
        // storage full/blocked — cart stays in memory
      }
    }, 150);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [items, hydrated]);

  // Accept cart merges from the Supabase sync hook (cross-device restore)
  useEffect(() => {
    function onMerge(e: Event) {
      const detail = (e as CustomEvent<CartItem[]>).detail;
      if (Array.isArray(detail)) setItems(detail);
    }
    window.addEventListener("jrubiecakes:merge-cart", onMerge);
    return () => window.removeEventListener("jrubiecakes:merge-cart", onMerge);
  }, []);

  const showToast = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const addItem = useCallback(
    (item: Omit<CartItem, "key">) => {
      const key = lineKey(item.productId, item.options);
      setItems((prev) => {
        const existing = prev.find((i) => i.key === key);
        if (existing) {
          // Same product + same customization: merge quantities, keep one line
          return prev.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + item.quantity } : i
          );
        }
        return [...prev, { ...item, key }];
      });
      setDrawerOpen(true);
    },
    []
  );

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.key !== key)
        : prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(99, quantity) } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, itemCount, subtotal, hydrated, addItem, removeItem, updateQuantity, clearCart, isDrawerOpen, openDrawer, closeDrawer }}
    >
      <ToastContext.Provider value={{ showToast }}>
        {children}
        {/* Toasts */}
        <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
                t.kind === "success"
                  ? "bg-cocoa-700 text-cream-50"
                  : t.kind === "error"
                  ? "bg-red-600 text-white"
                  : "bg-white text-cocoa-800 border border-cocoa-200"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </CartContext.Provider>
  );
}
