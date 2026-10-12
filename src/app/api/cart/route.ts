import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { customCakeSchema } from '@/lib/validation';
import { getRequestUser } from '@/lib/supabase/request-user';
import { jsonWithCors, preflight } from '@/lib/cors';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const optionRefSchema = z.object({
  optionId: z.string().uuid(),
  valueId: z.string().uuid().nullable(),
  textValue: z.string().max(500).optional(),
});

const cartItemSchema = z.object({
  key: z.string().min(1).max(500),
  productId: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  imageUrl: z.string().max(1000).nullable().optional(),
  unitPrice: z.number().int().min(0),
  quantity: z.number().int().min(1).max(99),
  options: z
    .array(
      z.object({
        optionName: z.string().max(100),
        value: z.string().max(500),
        priceDelta: z.number().int().min(0),
      })
    )
    .max(20),
  optionRefs: z.array(optionRefSchema).max(20).optional(),
  customCake: customCakeSchema,
});

const bodySchema = z.object({ items: z.array(cartItemSchema).max(50) });

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return jsonWithCors(request, { error: 'Not signed in' }, 401);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('cart_state')
    .select('items, updated_at')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return jsonWithCors(request, { error: 'Could not load cart' }, 500);
  }

  return jsonWithCors(request, { items: (data?.items as any) ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return jsonWithCors(request, { error: 'Not signed in' }, 401);

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return jsonWithCors(request, { error: 'Invalid body' }, 400);
  }
  if (!parsed.success) {
    return jsonWithCors(request, { error: 'Invalid cart payload' }, 400);
  }

  const admin = createAdminClient();
  const { error } = await admin.from('cart_state').upsert(
    { user_id: user.id, items: parsed.data.items as any },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('[cart] upsert failed:', error.message);
    return jsonWithCors(request, { error: 'Could not save cart' }, 500);
  }

  return jsonWithCors(request, { ok: true });
}
