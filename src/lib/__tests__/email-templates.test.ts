import { describe, expect, it } from "vitest";
import {
  ORDER_STATUS_EMAIL_NOTES,
  adminBankTransferOrderEmail,
  adminNewOrderEmail,
  adminPaymentSuccessEmail,
  bankTransferAwaitingEmail,
  orderConfirmationEmail,
  orderStatusUpdateEmail,
  paymentConfirmedEmail,
} from "@/lib/email-templates";
import type { PricedLine } from "@/lib/pricing";

/** A realistic customized-cake line (prices in kobo). */
function line(overrides: Partial<PricedLine> = {}): PricedLine {
  return {
    productId: "11111111-1111-1111-1111-111111111111",
    productName: "Custom Birthday Cake",
    slug: "custom-birthday-cake",
    imageUrl: null,
    unitPrice: 3_500_000,
    quantity: 1,
    lineTotal: 3_500_000,
    options: [
      { optionName: "Cake size", value: "8 inch", priceDelta: 800_000 },
      { optionName: "Flavour", value: "Chocolate", priceDelta: 0 },
      { optionName: "Frosting", value: "Buttercream", priceDelta: 0 },
      { optionName: "Theme", value: "Princess", priceDelta: 0 },
      { optionName: "Message on cake", value: "Happy Birthday Ada", priceDelta: 0 },
    ],
    minOrderQuantity: 1,
    ...overrides,
  };
}

const ORDER = "JR-2001";

describe("ORDER_STATUS_EMAIL_NOTES", () => {
  it("covers every order lifecycle status", () => {
    for (const status of [
      "pending",
      "awaiting_payment",
      "paid",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "completed",
      "cancelled",
    ]) {
      expect(ORDER_STATUS_EMAIL_NOTES[status]).toBeTruthy();
    }
  });

  it("uses friendly, non-empty labels for the requested statuses", () => {
    expect(ORDER_STATUS_EMAIL_NOTES.confirmed).toBe("Order confirmed");
    expect(ORDER_STATUS_EMAIL_NOTES.preparing).toBe("Now baking");
    expect(ORDER_STATUS_EMAIL_NOTES.ready).toBe("Ready for pickup/delivery");
    expect(ORDER_STATUS_EMAIL_NOTES.out_for_delivery).toBe("Out for delivery");
    expect(ORDER_STATUS_EMAIL_NOTES.completed).toBe("Delivered — enjoy!");
    expect(ORDER_STATUS_EMAIL_NOTES.cancelled).toBe("Order cancelled");
  });
});

describe("orderStatusUpdateEmail", () => {
  it("puts the status label in the subject and body", () => {
    const mail = orderStatusUpdateEmail({
      orderNumber: ORDER,
      customerName: "Ada",
      status: "preparing",
      statusNote: ORDER_STATUS_EMAIL_NOTES.preparing,
    });
    expect(mail.subject).toBe(`Order ${ORDER} — Now baking`);
    expect(mail.html).toContain("Now baking");
    expect(mail.html).toContain(ORDER);
  });

  it("includes full order details when lines are provided", () => {
    const mail = orderStatusUpdateEmail({
      orderNumber: ORDER,
      customerName: "Ada",
      status: "ready",
      statusNote: ORDER_STATUS_EMAIL_NOTES.ready,
      lines: [line()],
      subtotal: 3_500_000,
      deliveryFee: 300_000,
      total: 3_800_000,
      paymentMethod: "bank_transfer",
      fulfillmentType: "delivery",
      requestedDate: "2026-03-14",
    });

    expect(mail.html).toContain("Custom Birthday Cake");
    expect(mail.html).toContain("Cake size: 8 inch");
    expect(mail.html).toContain("Happy Birthday Ada");
    expect(mail.html).toContain("Subtotal");
    expect(mail.html).toContain("Delivery fee");
    expect(mail.html).toContain("Total");
    expect(mail.html).toContain("35,000");
    expect(mail.html).toContain("38,000");
    expect(mail.html).toContain("bank transfer");
    expect(mail.html).toContain("Delivery");
    expect(mail.html).toContain("2026-03-14");
  });

  it("omits the items table when no lines are supplied", () => {
    const mail = orderStatusUpdateEmail({
      orderNumber: ORDER,
      customerName: "Ada",
      status: "confirmed",
      statusNote: ORDER_STATUS_EMAIL_NOTES.confirmed,
    });
    expect(mail.html).not.toContain("Subtotal");
    expect(mail.html).not.toContain("Custom Birthday Cake");
  });
});

describe("HTML escaping", () => {
  it("escapes a malicious customer name", () => {
    const mail = orderStatusUpdateEmail({
      orderNumber: ORDER,
      customerName: '<script>alert("x")</script>',
      status: "confirmed",
      statusNote: ORDER_STATUS_EMAIL_NOTES.confirmed,
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("escapes product names and option values in the items table", () => {
    const mail = orderStatusUpdateEmail({
      orderNumber: ORDER,
      customerName: "Ada",
      status: "preparing",
      statusNote: ORDER_STATUS_EMAIL_NOTES.preparing,
      lines: [
        line({
          productName: "<b>Cake</b>",
          options: [{ optionName: "Message", value: '<img src=x onerror="y">', priceDelta: 0 }],
        }),
      ],
      subtotal: 3_500_000,
      deliveryFee: 0,
      total: 3_500_000,
    });
    expect(mail.html).not.toContain("<b>Cake</b>");
    expect(mail.html).toContain("&lt;b&gt;Cake&lt;/b&gt;");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img src=x");
  });

  it("escapes bank details coming from admin settings", () => {
    const mail = bankTransferAwaitingEmail({
      orderNumber: ORDER,
      customerName: "Ada",
      lines: [line()],
      subtotal: 3_500_000,
      deliveryFee: 0,
      total: 3_500_000,
      fulfillmentType: "delivery",
      bankDetails: {
        bankName: 'GTBank "Premier"',
        accountNumber: "0123456789",
        accountName: "<Ada's Bakery>",
      },
    });
    expect(mail.html).toContain("&quot;Premier&quot;");
    expect(mail.html).not.toContain("<Ada's Bakery>");
    expect(mail.html).toContain("&lt;Ada&#039;s Bakery&gt;");
  });
});

describe("bank transfer details block", () => {
  const bankDetails = {
    bankName: "GTBank",
    accountNumber: "0123456789",
    accountName: "Jrubiecakes Ltd",
  };

  it("bankTransferAwaitingEmail shows bank name, account number, account name and narration", () => {
    const mail = bankTransferAwaitingEmail({
      orderNumber: ORDER,
      customerName: "Ada",
      lines: [line()],
      subtotal: 3_500_000,
      deliveryFee: 300_000,
      total: 3_800_000,
      fulfillmentType: "delivery",
      requestedDate: "2026-03-14",
      bankDetails,
    });

    expect(mail.subject).toContain(ORDER);
    expect(mail.html).toContain("GTBank");
    expect(mail.html).toContain("0123456789");
    expect(mail.html).toContain("Jrubiecakes Ltd");
    expect(mail.html).toContain("Narration");
    expect(mail.html).toContain(`Order ${ORDER}`);
    expect(mail.html).toContain("awaiting payment");
    expect(mail.html).toContain("38,000"); // total incl. delivery
    expect(mail.html).toContain("2026-03-14");
  });

  it("orderConfirmationEmail includes transfer instructions when bank details are set", () => {
    const mail = orderConfirmationEmail({
      orderNumber: ORDER,
      customerName: "Ada",
      lines: [line()],
      subtotal: 3_500_000,
      deliveryFee: 300_000,
      total: 3_800_000,
      paymentMethod: "bank_transfer",
      fulfillmentType: "delivery",
      requestedDate: "2026-03-14",
      bankDetails,
    });
    expect(mail.html).toContain("Please transfer");
    expect(mail.html).toContain("0123456789");
    expect(mail.html).toContain("Jrubiecakes Ltd");
    expect(mail.html).toContain(`<strong>${ORDER}</strong> as the transfer narration`);
  });

  it("orderConfirmationEmail tells cash customers what to prepare", () => {
    const mail = orderConfirmationEmail({
      orderNumber: ORDER,
      customerName: "Ada",
      lines: [line()],
      subtotal: 3_500_000,
      deliveryFee: 0,
      total: 3_500_000,
      paymentMethod: "cash",
      fulfillmentType: "pickup",
    });
    expect(mail.html).toContain("cash on delivery/pickup");
    expect(mail.html).toContain("35,000");
    expect(mail.html).toContain("Pickup");
  });

  it("adminBankTransferOrderEmail flags the order for confirmation", () => {
    const mail = adminBankTransferOrderEmail({
      orderNumber: ORDER,
      customerName: "Ada",
      customerPhone: "08031234567",
      lines: [line()],
      subtotal: 3_500_000,
      deliveryFee: 0,
      total: 3_500_000,
    });
    expect(mail.subject).toContain("Bank transfer awaiting confirmation");
    expect(mail.subject).toContain(ORDER);
    expect(mail.html).toContain("bank transfer");
    expect(mail.html).toContain("08031234567");
  });
});

describe("view your order button", () => {
  it("links to the order tracking page in every customer email", () => {
    const emails = [
      orderConfirmationEmail({
        orderNumber: ORDER,
        customerName: "Ada",
        lines: [line()],
        subtotal: 3_500_000,
        deliveryFee: 0,
        total: 3_500_000,
        paymentMethod: "cash",
        fulfillmentType: "pickup",
      }),
      paymentConfirmedEmail({ orderNumber: ORDER, customerName: "Ada", amountKobo: 3_500_000 }),
      bankTransferAwaitingEmail({
        orderNumber: ORDER,
        customerName: "Ada",
        lines: [line()],
        subtotal: 3_500_000,
        deliveryFee: 0,
        total: 3_500_000,
        fulfillmentType: "delivery",
        bankDetails: { bankName: "GTBank", accountNumber: "0123456789", accountName: "Jrubiecakes" },
      }),
      orderStatusUpdateEmail({
        orderNumber: ORDER,
        customerName: "Ada",
        status: "completed",
        statusNote: ORDER_STATUS_EMAIL_NOTES.completed,
      }),
    ];

    for (const mail of emails) {
      expect(mail.html).toContain("View your order");
      expect(mail.html).toContain(`/orders/${ORDER}`);
    }
  });

  it("does not add the tracking button to admin emails", () => {
    const adminMails = [
      adminNewOrderEmail({
        orderNumber: ORDER,
        customerName: "Ada",
        customerPhone: "08031234567",
        lines: [line()],
        subtotal: 3_500_000,
        deliveryFee: 0,
        total: 3_500_000,
        paymentMethod: "paystack",
      }),
      adminPaymentSuccessEmail({ orderNumber: ORDER, customerName: "Ada", amountKobo: 3_500_000 }),
    ];

    for (const mail of adminMails) {
      expect(mail.html).not.toContain("View your order");
    }
  });
});

describe("payment notifications", () => {
  it("paymentConfirmedEmail shows the amount and order number", () => {
    const mail = paymentConfirmedEmail({ orderNumber: ORDER, customerName: "Ada", amountKobo: 3_500_000 });
    expect(mail.subject).toContain(ORDER);
    expect(mail.html).toContain("35,000");
  });

  it("adminPaymentSuccessEmail mentions the verified amount", () => {
    const mail = adminPaymentSuccessEmail({ orderNumber: ORDER, customerName: "Ada", amountKobo: 3_500_000 });
    expect(mail.subject).toContain(ORDER);
    expect(mail.subject).toContain("Payment received");
    expect(mail.html).toContain("35,000");
  });
});
