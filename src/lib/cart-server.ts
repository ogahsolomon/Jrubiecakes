import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePrice } from "@/lib/money";
import type { CartItem, CartItemOptionRef } from "@/types";

export async function fetchProductPrice(
  productId: string,
  optionRefs?: CartItemOptionRef[]
): Promise<{
  ok: boolean;
  unitPrice: number;
  name?: string;
  slug?: string;
  imageUrl?: string | null;
  error?: string;
}> {
  const sb = createAdminClient();
  const { data: product, error } = await sb
    .from("products")
    .select("id, name, slug, price, sale_price, is_available")
    .eq("id", productId)
    .eq("is_available", true)
    .single();

  if (error || !product) {
    return { ok: false, unitPrice: 0, error: "Product not available" };
  }

  let unitPrice = effectivePrice(product.price, product.sale_price) * 100;
  if (optionRefs && optionRefs.length > 0) {
    const valueIds = optionRefs
      .map((r) => r.valueId)
      .filter((v): v is string => !!v);
    if (valueIds.length > 0) {
      const { data: values } = await sb
        .from("product_option_values")
        .select("id, price_delta")
        .in("id", valueIds);
      const deltaMap = new Map((values ?? []).map((v) => [v.id, Number(v.price_delta) * 100]));
      for (const r of optionRefs) {
        if (r.valueId) {
          unitPrice += deltaMap.get(r.valueId) ?? 0;
        }
      }
    }
  }
  const imageUrl = await getProductPrimaryImage(sb, productId);
  return { ok: true, unitPrice: Math.max(0, Math.round(unitPrice)), name: product.name, slug: product.slug, imageUrl };
}

async function getProductPrimaryImage(sb: ReturnType<typeof createAdminClient>, productId: string): Promise<string | null> {
  const { data } = await sb
    .from("product_images")
    .select("url, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.url ?? null;
}

export function buildLineKey(productId: string, options: CartItem["options"]): string {
  const keyPart = options
    .map((o) => `${o.optionName}=${o.value}`)
    .sort()
    .join("|");
  return `${productId}::${keyPart}`;
}
