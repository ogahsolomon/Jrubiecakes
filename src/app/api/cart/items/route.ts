import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
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

export async function POST(request: NextRequest) {
  let parsed;
  try {
    parsed = addSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { productId, quantity, optionRefs, customCake } = parsed.data;
  const priceInfo = await fetchProductPrice(productId, optionRefs);
  if (!priceInfo.ok) {
    return NextResponse.json({ error: priceInfo.error ?? 'Product unavailable' }, { status: 400 });
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
    .eq('user_id', user.id)
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
    { user_id: user.id, items: items as any },
    { onConflict: 'user_id' }
  );
  if (error) return NextResponse.json({ error: 'Could not save cart' }, { status: 500 });

  return NextResponse.json({ items });
}
