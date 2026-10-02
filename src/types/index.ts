import type { Database } from "./database";

export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  product_images?: ProductImage[];
  product_options?: ProductOption[];
  categories?: { id: string; name: string; slug: string } | null;
};

export type ProductImage = Database["public"]["Tables"]["product_images"]["Row"];
export type ProductOption = Database["public"]["Tables"]["product_options"]["Row"] & {
  product_option_values?: ProductOptionValue[];
};
export type ProductOptionValue = Database["public"]["Tables"]["product_option_values"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: OrderItem[];
  payments?: Payment[];
};
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"] & {
  order_item_options?: OrderItemOption[];
};
export type OrderItemOption = Database["public"]["Tables"]["order_item_options"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type DeliverySetting = Database["public"]["Tables"]["delivery_settings"]["Row"];

export type CartItemOption = {
  optionName: string;
  value: string;
  priceDelta: number;
};

/** Server-side option references so checkout re-prices the exact selection. */
export type CartItemOptionRef = {
  optionId: string;
  valueId: string | null;
  textValue?: string;
};

export type CartItem = {
  key: string;
  productId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  options: CartItemOption[];
  /** Present when the product was customized; used for server-side repricing. */
  optionRefs?: CartItemOptionRef[];
};

export type FulfillmentType = "delivery" | "pickup";
export type PaymentMethod = "paystack" | "bank_transfer" | "cash";

export const ORDER_STATUSES = [
  "pending",
  "awaiting_payment",
  "paid",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  awaiting_payment: "Awaiting Payment",
  paid: "Paid",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for Delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  awaiting_payment: "Awaiting Payment",
  paid: "Paid",
  failed: "Failed",
  abandoned: "Abandoned",
  refunded: "Refunded",
};
