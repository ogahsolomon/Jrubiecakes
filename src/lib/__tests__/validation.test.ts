import { describe, expect, it } from "vitest";
import { checkoutSchema, phoneSchema } from "../validation";

const validCheckout = {
  customer: { fullName: "Adaeze Obi", email: "adaeze@example.com", phone: "08031234567" },
  delivery: {
    fulfillmentType: "delivery",
    addressLine: "12 Allen Avenue, Ikeja",
    city: "Lagos",
    state: "Lagos",
  },
  orderDetails: {
    requestedDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  },
  paymentMethod: "paystack",
};

describe("phoneSchema", () => {
  it("accepts valid Nigerian numbers", () => {
    expect(phoneSchema.safeParse("08031234567").success).toBe(true);
    expect(phoneSchema.safeParse("+2348031234567").success).toBe(true);
    expect(phoneSchema.safeParse("2348031234567").success).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(phoneSchema.safeParse("12345").success).toBe(false);
    expect(phoneSchema.safeParse("06031234567").success).toBe(false); // 06 prefix invalid for mobile
    expect(phoneSchema.safeParse("0803123456").success).toBe(false); // too short
  });
});

describe("checkoutSchema", () => {
  it("accepts a valid delivery checkout", () => {
    expect(checkoutSchema.safeParse(validCheckout).success).toBe(true);
  });

  it("accepts pickup without address", () => {
    const result = checkoutSchema.safeParse({
      ...validCheckout,
      delivery: { fulfillmentType: "pickup" },
    });
    expect(result.success).toBe(true);
  });

  it("requires address for delivery", () => {
    const result = checkoutSchema.safeParse({
      ...validCheckout,
      delivery: { fulfillmentType: "delivery" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid Nigerian states for delivery", () => {
    const result = checkoutSchema.safeParse({
      ...validCheckout,
      delivery: { ...validCheckout.delivery, state: "California" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects past requested dates", () => {
    const result = checkoutSchema.safeParse({
      ...validCheckout,
      orderDetails: { requestedDate: "2020-01-01" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects bad payment methods", () => {
    const result = checkoutSchema.safeParse({
      ...validCheckout,
      paymentMethod: "crypto",
    });
    expect(result.success).toBe(false);
  });
});
