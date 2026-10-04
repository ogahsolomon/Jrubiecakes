'use client';

import type { CartItem } from '@/types';

const STORAGE_KEY = 'jrubiecakes-cart-v1';

export function loadLocalCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as CartItem[];
    }
  } catch {}
  return [];
}

export function saveLocalCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function clearLocalCart() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
