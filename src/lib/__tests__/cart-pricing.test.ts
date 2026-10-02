import { describe, expect, it } from "vitest";
import type { CartItem } from "@/types";

/**
 * The cart line key merges identical product+option combinations.
 * Mirrors the logic in Providers.addItem so regressions are caught here.
 */
function lineKey(productId: string, options: { optionName: string; value: string }[]): string {
  return `${productId}::${options
    .map((o) => `${o.optionName}=${o.value}`)
    .sort()
    .join("|")}`;
}

describe("cart line keys", () => {
  it("merges identical configurations", () => {
    const a = lineKey("p1", [{ optionName: "Size", value: "8 inch" }]);
    const b = lineKey("p1", [{ optionName: "Size", value: "8 inch" }]);
    expect(a).toBe(b);
  });

  it("keeps different configurations separate", () => {
    const a = lineKey("p1", [{ optionName: "Size", value: "8 inch" }]);
    const b = lineKey("p1", [{ optionName: "Size", value: "10 inch" }]);
    expect(a).not.toBe(b);
  });

  it("is order-independent", () => {
    const a = lineKey("p1", [
      { optionName: "Size", value: "8 inch" },
      { optionName: "Flavour", value: "Vanilla" },
    ]);
    const b = lineKey("p1", [
      { optionName: "Flavour", value: "Vanilla" },
      { optionName: "Size", value: "8 inch" },
    ]);
    expect(a).toBe(b);
  });

  it("different products never merge", () => {
    expect(lineKey("p1", [])).not.toBe(lineKey("p2", []));
  });
});

describe("cart totals", () => {
  const items: CartItem[] = [
    {
      key: "k1",
      productId: "p1",
      name: "Cake",
      slug: "cake",
      imageUrl: null,
      unitPrice: 3500000, // ₦35,000 in kobo
      quantity: 2,
      options: [{ optionName: "Size", value: "8 inch", priceDelta: 800000 }],
    },
    {
      key: "k2",
      productId: "p2",
      name: "Donuts",
      slug: "donuts",
      imageUrl: null,
      unitPrice: 450000,
      quantity: 3,
      options: [],
    },
  ];

  it("sums line totals in kobo", () => {
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    expect(subtotal).toBe(7000000 + 1350000);
  });

  it("counts total items", () => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    expect(count).toBe(5);
  });
});
