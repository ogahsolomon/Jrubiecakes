import { describe, expect, it } from "vitest";
import { effectivePrice, formatNGN, formatPriceNaira, isOnSale, koboToNaira, nairaToKobo } from "../money";

describe("money conversions", () => {
  it("converts kobo to naira", () => {
    expect(koboToNaira(125000)).toBe(1250);
    expect(koboToNaira(1)).toBe(0.01);
  });

  it("converts naira to kobo rounding correctly", () => {
    expect(nairaToKobo(1250)).toBe(125000);
    expect(nairaToKobo(10.555)).toBe(1056); // rounds half up
  });

  it("formats NGN with naira symbol and thousands separators", () => {
    expect(formatNGN(1250000)).toContain("12,500");
    expect(formatNGN(1250000)).toContain("₦");
  });

  it("hides kobo when whole naira", () => {
    expect(formatNGN(1250000)).not.toMatch(/\.00/);
  });

  it("shows kobo for fractional naira", () => {
    expect(formatNGN(1255)).toMatch(/12\.55/);
  });

  it("formats naira product prices", () => {
    expect(formatPriceNaira(35000)).toContain("35,000");
  });
});

describe("effectivePrice", () => {
  it("uses sale price when lower", () => {
    expect(effectivePrice(35000, 30000)).toBe(30000);
  });

  it("uses regular price when sale is absent", () => {
    expect(effectivePrice(35000, null)).toBe(35000);
  });

  it("ignores sale price higher than regular", () => {
    expect(effectivePrice(35000, 40000)).toBe(35000);
  });

  it("ignores zero sale price", () => {
    expect(effectivePrice(35000, 0)).toBe(35000);
  });
});

describe("isOnSale", () => {
  it("detects valid sales", () => {
    expect(isOnSale(35000, 30000)).toBe(true);
  });

  it("rejects invalid sales", () => {
    expect(isOnSale(35000, null)).toBe(false);
    expect(isOnSale(35000, 35000)).toBe(false);
    expect(isOnSale(35000, 40000)).toBe(false);
  });
});
