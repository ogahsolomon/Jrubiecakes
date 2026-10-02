/**
 * Money helpers. All monetary values are stored as integers in kobo
 * (1 naira = 100 kobo) to avoid floating-point errors, matching Paystack.
 */

export function koboToNaira(kobo: number): number {
  return Math.round(kobo) / 100;
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/** Format kobo integer as NGN string: ₦12,500.00 */
export function formatNGN(kobo: number, opts?: { showKobo?: boolean }): string {
  const naira = koboToNaira(kobo);
  const showKobo = opts?.showKobo ?? naira % 1 !== 0;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: showKobo ? 2 : 0,
    maximumFractionDigits: showKobo ? 2 : 0,
  }).format(naira);
}

/** Format a naira float (product.price column) for display. */
export function formatPriceNaira(naira: number): string {
  return formatNGN(nairaToKobo(naira));
}

/** Effective selling price (sale price if set and lower). */
export function effectivePrice(price: number, salePrice: number | null): number {
  if (salePrice != null && salePrice > 0 && salePrice < price) return salePrice;
  return price;
}

export function isOnSale(price: number, salePrice: number | null): boolean {
  return salePrice != null && salePrice > 0 && salePrice < price;
}
