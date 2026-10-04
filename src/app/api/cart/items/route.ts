import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getRequestUser } from '@/lib/supabase/request-user';
import { jsonWithCors, preflight } from '@/lib/cors';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchProductPrice, buildLineKey } from '@/lib/cart-server';
import type { CartItem } from '@/types';

export const dynamic = 'force-dynamic';

const optionRefSchema = z.object({
  optionId: z.string().uuid(),
  valueId: z.string().uuid().nullable(),
  textValue: z.string().max(500).optional(),
});

const addSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99).default(1),
  optionRefs: z.array(optionRefSchema).max(20).optional(),
  customCake: z.any().optional(),
});

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest) {
  const authUser = await getRequestUser(request);
  if (!authUser) return jsonWithCors(request, { error: 'Not signed in' }, 401);
  let parsed;
  try {
    parsed = addSchema.safeParse(await request.json());
  } catch {
    return jsonWithCors(request, { error: 'Invalid body' }, 400);
  }
  if (!parsed.success) {
    return jsonWithCors(request, { error: 'Invalid payload' }, 400);
  }


  const { productId, quantity, optionRefs, customCake } = parsed.data;
  const priceInfo = await fetchProductPrice(productId, optionRefs);
  if (!priceInfo.ok) {
    return jsonWithCors(request, { error: priceInfo.error ?? 'Product unavailable' }, 400);
  }

  const optionsForKey: CartItem['options'] = (optionRefs ?? []).map((r) => ({
    optionName: r.optionId,
    value: r.valueId ?? r.textValue ?? '',
    priceDelta: 0,
  }));
  const key = buildLineKey(productId, optionsForKey);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('cart_state')
    .select('items')
    .eq('user_id', authUser.id)
    .single();

  let items: CartItem[] = ((existing?.items as any) ?? []) as CartItem[];
  const idx = items.findIndex((i) => i.key === key);
  if (idx >= 0) {
    items[idx] = { ...items[idx], quantity: Math.min(99, items[idx].quantity + quantity) };
  } else {
    items.push({
      key,
      productId,
      name: priceInfo.name ?? '',
      slug: priceInfo.slug ?? '',
      imageUrl: priceInfo.imageUrl ?? null,
      unitPrice: priceInfo.unitPrice,
      quantity,
      options: optionsForKey,
      optionRefs,
      customCake,
    });
  }

  const { error } = await admin.from('cart_state').upsert(
    { user_id: authUser.id, items: items as any },
    { onConflict: 'user_id' }
  );
  if (error) return jsonWithCors(request, { error: 'Could not save cart' }, 500);

  return NextResponse.json({ items });
}

