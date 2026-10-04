import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
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
  customCake: z.any().optional(),
});

const bodySchema = z.object({ items: z.array(cartItemSchema).max(50) });

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('cart_state')
    .select('items, updated_at')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Could not load cart' }, { status: 500 });
  }

  return NextResponse.json({ items: (data?.items as any) ?? [] });
}

export async function POST(request: NextRequest) {
  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid cart payload' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from('cart_state').upsert(
    { user_id: user.id, items: parsed.data.items as any },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('[cart] upsert failed:', error.message);
    return NextResponse.json({ error: 'Could not save cart' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
