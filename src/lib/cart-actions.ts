'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchProductPrice, buildLineKey } from '@/lib/cart-server';
import type { CartItem, CartItemOptionRef } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getCartAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [] as CartItem[] };

  const admin = createAdminClient();
  const { data } = await admin
    .from('cart_state')
    .select('items')
    .eq('user_id', user.id)
    .single();
  return { items: ((data?.items as any) ?? []) as CartItem[] };
}

export async function addToCartAction(input: {
  productId: string;
  quantity?: number;
  optionRefs?: CartItemOptionRef[];
  customCake?: any;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const quantity = input.quantity ?? 1;
  const priceInfo = await fetchProductPrice(input.productId, input.optionRefs);
  if (!priceInfo.ok) throw new Error(priceInfo.error ?? 'Product unavailable');

  const optionsForKey: CartItem['options'] = (input.optionRefs ?? []).map((r) => ({
    optionName: r.optionId,
    value: r.valueId ?? r.textValue ?? '',
    priceDelta: 0,
  }));
  const key = buildLineKey(input.productId, optionsForKey);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('cart_state')
    .select('items')
    .eq('user_id', user.id)
    .single();

  let items: CartItem[] = ((existing?.items as any) ?? []) as CartItem[];
  const idx = items.findIndex((i) => i.key === key);
  if (idx >= 0) {
    items[idx] = { ...items[idx], quantity: Math.min(99, items[idx].quantity + quantity) };
  } else {
    items.push({
      key,
      productId: input.productId,
      name: priceInfo.name ?? '',
      slug: priceInfo.slug ?? '',
      imageUrl: priceInfo.imageUrl ?? null,
      unitPrice: priceInfo.unitPrice,
      quantity,
      options: optionsForKey,
      optionRefs: input.optionRefs,
      customCake: input.customCake,
    });
  }

  const { error } = await admin.from('cart_state').upsert(
    { user_id: user.id, items: items as any },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error('Could not save cart');

  revalidatePath('/cart');
  return { items };
}

export async function updateCartQuantityAction(key: string, quantity: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Invalid quantity');

  const admin = createAdminClient();
  const { data: existing } = await admin.from('cart_state').select('items').eq('user_id', user.id).single();
  let items: CartItem[] = ((existing?.items as any) ?? []) as CartItem[];
  const idx = items.findIndex((i) => i.key === key);
  if (idx < 0) return { items };

  items[idx] = { ...items[idx], quantity };
  const { error } = await admin.from('cart_state').upsert({ user_id: user.id, items: items as any }, { onConflict: 'user_id' });
  if (error) throw new Error('Could not save cart');

  revalidatePath('/cart');
  return { items };
}

export async function removeCartItemAction(key: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const admin = createAdminClient();
  const { data: existing } = await admin.from('cart_state').select('items').eq('user_id', user.id).single();
  let items: CartItem[] = ((existing?.items as any) ?? []) as CartItem[];
  items = items.filter((i) => i.key !== key);
  const { error } = await admin.from('cart_state').upsert({ user_id: user.id, items: items as any }, { onConflict: 'user_id' });
  if (error) throw new Error('Could not save cart');

  revalidatePath('/cart');
  return { items };
}

export async function clearCartAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const admin = createAdminClient();
  const { error } = await admin.from('cart_state').upsert({ user_id: user.id, items: [] as any }, { onConflict: 'user_id' });
  if (error) throw new Error('Could not clear cart');

  revalidatePath('/cart');
  return { items: [] as CartItem[] };
}

export async function mergeLocalCartAction(localItems: CartItem[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  if (!Array.isArray(localItems) || localItems.length === 0) return { items: [] as CartItem[] };

  const admin = createAdminClient();
  const { data: existing } = await admin.from('cart_state').select('items').eq('user_id', user.id).single();
  let serverItems: CartItem[] = ((existing?.items as any) ?? []) as CartItem[];

  const merged = [...serverItems];
  const byKey = new Map(merged.map((i) => [i.key, i]));

  for (const local of localItems) {
    const existingItem = byKey.get(local.key);
    if (!existingItem) {
      merged.push(local);
      byKey.set(local.key, local);
    } else if (local.quantity > existingItem.quantity) {
      const idx = merged.findIndex((m) => m.key === local.key);
      if (idx >= 0) {
        merged[idx] = { ...existingItem, quantity: local.quantity };
      }
    }
  }

  const { error } = await admin.from('cart_state').upsert({ user_id: user.id, items: merged as any }, { onConflict: 'user_id' });
  if (error) throw new Error('Could not merge cart');

  revalidatePath('/cart');
  return { items: merged };
}
