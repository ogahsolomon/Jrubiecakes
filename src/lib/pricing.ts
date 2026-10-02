import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePrice, nairaToKobo } from "./money";
import type { DeliverySetting } from "@/types";

export type ServerCartLine = {
  productId: string;
  quantity: number;
  options: { optionId: string; valueId: string | null; textValue?: string }[];
};

export type PricedOption = {
  optionName: string;
  value: string;
  priceDelta: number;
};

export type PricedLine = {
  productId: string;
  productName: string;
  slug: string;
  imageUrl: string | null;
  unitPrice: number; // kobo
  quantity: number;
  lineTotal: number; // kobo
  options: PricedOption[];
  minOrderQuantity: number;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number; // kobo
  deliveryFee: number; // kobo
  total: number; // kobo
  issues: string[];
};

/**
 * Recalculate the entire cart from database prices. NEVER trust prices
 * from the browser: the client only sends product IDs, quantities and
 * option selections; every monetary value is re-derived here.
 */
export async function priceCartServerSide(
  cart: ServerCartLine[],
  fulfillmentType: "delivery" | "pickup",
  state?: string | null
): Promise<PricedCart> {
  const admin = createAdminClient();
  const issues: string[] = [];

  if (!cart.length) {
    return { lines: [], subtotal: 0, deliveryFee: 0, total: 0, issues: ["Cart is empty"] };
  }

  const productIds = [...new Set(cart.map((l) => l.productId))];
  const optionIds = [
    ...new Set(cart.flatMap((l) => l.options.map((o) => o.optionId))),
  ];
  const valueIds = [
    ...new Set(
      cart.flatMap((l) => l.options.map((o) => o.valueId).filter((v): v is string => !!v))
    ),
  ];

  const [productsRes, optionsRes, valuesRes] = await Promise.all([
    admin.from("products").select("id, name, slug, price, sale_price, is_available, min_order_quantity").in("id", productIds),
    optionIds.length
      ? admin.from("product_options").select("id, product_id, name, is_required").in("id", optionIds)
      : Promise.resolve({ data: [], error: null }),
    valueIds.length
      ? admin.from("product_option_values").select("id, option_id, value, price_delta").in("id", valueIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsRes.error || optionsRes.error || valuesRes.error) {
    return {
      lines: [],
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
      issues: ["Could not verify cart contents. Please try again."],
    };
  }

  const products = new Map((productsRes.data ?? []).map((p) => [p.id, p]));
  const options = new Map((optionsRes.data ?? []).map((o) => [o.id, o]));
  const values = new Map((valuesRes.data ?? []).map((v) => [v.id, v]));

  const lines: PricedLine[] = [];

  for (const line of cart) {
    const product = products.get(line.productId);
    if (!product) {
      issues.push("A product in your cart is no longer available and was removed.");
      continue;
    }
    if (!product.is_available) {
      issues.push(`"${product.name}" is currently unavailable and was removed.`);
      continue;
    }

    const minQty = product.min_order_quantity ?? 1;
    let quantity = Math.max(1, Math.floor(line.quantity));
    if (quantity < minQty) {
      issues.push(`"${product.name}" has a minimum order of ${minQty}. Quantity adjusted.`);
      quantity = minQty;
    }

    const basePrice = effectivePrice(product.price, product.sale_price);
    let unitPriceKobo = nairaToKobo(basePrice);
    const pricedOptions: PricedOption[] = [];

    for (const opt of line.options) {
      const optionDef = options.get(opt.optionId);
      if (!optionDef || optionDef.product_id !== line.productId) {
        issues.push(`An option on "${product.name}" is invalid and was removed.`);
        continue;
      }

      if (opt.valueId) {
        const valueDef = values.get(opt.valueId);
        if (!valueDef || valueDef.option_id !== opt.optionId) {
          issues.push(`An option on "${product.name}" is invalid and was removed.`);
          continue;
        }
        unitPriceKobo += Math.round(valueDef.price_delta * 100);
        pricedOptions.push({
          optionName: optionDef.name,
          value: valueDef.value,
          priceDelta: Math.round(valueDef.price_delta * 100),
        });
      } else if (opt.textValue && opt.textValue.trim()) {
        pricedOptions.push({
          optionName: optionDef.name,
          value: opt.textValue.trim().slice(0, 500),
          priceDelta: 0,
        });
      }
    }

    lines.push({
      productId: product.id,
      productName: product.name,
      slug: product.slug,
      imageUrl: null, // filled by caller if needed
      unitPrice: unitPriceKobo,
      quantity,
      lineTotal: unitPriceKobo * quantity,
      options: pricedOptions,
      minOrderQuantity: minQty,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  // Delivery fee from configured zones (server-side only)
  let deliveryFee = 0;
  if (fulfillmentType === "delivery") {
    const { data: zones } = await admin
      .from("delivery_settings")
      .select("*")
      .eq("is_active", true);

    const activeZones = (zones ?? []) as DeliverySetting[];
    const matchingZone = state
      ? activeZones.find((z) => (z.states ?? []).includes(state))
      : undefined;
    const fallbackZone = activeZones.find((z) => z.zone_name === "Default");
    deliveryFee = Math.round((matchingZone ?? fallbackZone)?.fee ?? 0) * 100;
    if (state && !matchingZone && !fallbackZone) {
      deliveryFee = 0; // no configured zone; fee shown as TBD by admin contact
    }
  }

  return {
    lines,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    issues,
  };
}
