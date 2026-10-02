import { describe, expect, it } from "vitest";
import { generateOrderNumber, slugify, truncate } from "../utils";

describe("slugify", () => {
  it("slugifies product names", () => {
    expect(slugify("Custom Birthday Cake")).toBe("custom-birthday-cake");
    expect(slugify("Children's Cakes!")).toBe("childrens-cakes");
    expect(slugify("Chin Chin (Jar)")).toBe("chin-chin-jar");
  });

  it("collapses repeated separators", () => {
    expect(slugify("A  --  B__C")).toBe("a-b-c");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("-hello-")).toBe("hello");
  });
});

describe("generateOrderNumber", () => {
  it("matches the JRC-XXXXXX format", () => {
    expect(generateOrderNumber()).toMatch(/^JRC-[A-Z2-9]{6}$/);
  });

  it("generates unique numbers", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateOrderNumber()));
    expect(seen.size).toBeGreaterThan(190);
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world this is long", 10)).toBe("hello wor…");
  });
});
