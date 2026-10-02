/**
 * Display metadata for payment timeline events. Plain constants — safe to
 * import from both server components and client components.
 */
export const PAYMENT_EVENT_META: Record<string, { label: string; icon: string; className: string }> = {
  initialized: { label: "Checkout opened", icon: "🛒", className: "bg-cocoa-100 text-cocoa-700" },
  verification_started: { label: "Verification requested", icon: "🔎", className: "bg-cream-100 text-cocoa-600" },
  verified: { label: "Payment verified", icon: "✅", className: "bg-green-100 text-green-800" },
  webhook_received: { label: "Webhook received", icon: "📡", className: "bg-cocoa-100 text-cocoa-700" },
  amount_mismatch: { label: "Amount mismatch", icon: "⚠️", className: "bg-red-100 text-red-700" },
  failed: { label: "Payment failed", icon: "✕", className: "bg-red-100 text-red-700" },
  abandoned: { label: "Payment abandoned", icon: "⏸", className: "bg-amber-100 text-amber-800" },
  manually_updated: { label: "Updated by admin", icon: "👤", className: "bg-purple-100 text-purple-800" },
};

export type PaymentEventName = keyof typeof PAYMENT_EVENT_META;
