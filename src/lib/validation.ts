import { z } from "zod";
import { NIGERIAN_STATES } from "./constants";

export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^(\+?234|0)[789][01]\d{8}$/,
    "Enter a valid Nigerian phone number (e.g. 0803 123 4567)"
  );

export const checkoutSchema = z.object({
  customer: z.object({
    fullName: z.string().trim().min(2, "Full name is required").max(100),
    email: z.string().trim().email("Enter a valid email address"),
    phone: phoneSchema,
  }),
  delivery: z
    .object({
      fulfillmentType: z.enum(["delivery", "pickup"]),
      addressLine: z.string().trim().max(255).optional(),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(100).optional(),
      landmark: z.string().trim().max(255).optional(),
      deliveryInstructions: z.string().trim().max(500).optional(),
    })
    .superRefine((val, ctx) => {
      if (val.fulfillmentType === "delivery") {
        if (!val.addressLine || val.addressLine.length < 5) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["addressLine"],
            message: "Delivery address is required",
          });
        }
        if (!val.city) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["city"], message: "City is required" });
        }
        if (!val.state) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["state"], message: "State is required" });
        } else if (!NIGERIAN_STATES.includes(val.state as (typeof NIGERIAN_STATES)[number])) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["state"], message: "Select a valid Nigerian state" });
        }
      }
    }),
  orderDetails: z.object({
    requestedDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
      .refine((d) => {
        const date = new Date(d + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
      }, "Requested date cannot be in the past"),
    requestedTime: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
  paymentMethod: z.enum(["paystack", "bank_transfer", "cash"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const customCakeSchema = z
  .object({
    flavor: z.string().trim().max(200).optional(),
    size: z.string().trim().max(200).optional(),
    servings: z.string().trim().max(100).optional(),
    colors: z.string().trim().max(500).optional(),
    designNotes: z.string().trim().max(2000).optional(),
    referenceImageUrl: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
  .nullish();

export const cartItemSchema = z.object({
  productId: z.string().uuid("Invalid product"),
  quantity: z.number().int().min(1).max(100),
  options: z
    .array(
      z.object({
        optionId: z.string().uuid(),
        valueId: z.string().uuid().nullable(),
        textValue: z.string().max(500).optional(),
      })
    )
    .max(20),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Your name is required").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000),
});
