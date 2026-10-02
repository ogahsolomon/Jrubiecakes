import Link from "next/link";
import { Suspense } from "react";
import { formatNGN } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/catalog";

async function OrderSummary({ orderNumber }: { orderNumber: string }) {
  if (!isSupabaseConfigured) {
    return <p className="mt-3 text-sm text-cocoa-500">Order {orderNumber} has been received.</p>;
  }

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("order_number, total, payment_method, payment_status, requested_date, fulfillment_type")
    .eq("order_number", orderNumber)
    .single();

  if (!order) {
    return (
      <p className="mt-3 text-sm text-cocoa-500">
        We received your order ({orderNumber}). A confirmation email with full details is on its way.
      </p>
    );
  }

  return (
    <dl className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm">
      <div className="flex justify-between border-b border-cocoa-100 pb-2">
        <dt className="text-cocoa-500">Order number</dt>
        <dd className="font-bold text-cocoa-900">{order.order_number}</dd>
      </div>
      <div className="flex justify-between border-b border-cocoa-100 pb-2">
        <dt className="text-cocoa-500">Total</dt>
        <dd className="font-bold text-cocoa-900">{formatNGN(Math.round(order.total * 100))}</dd>
      </div>
      <div className="flex justify-between border-b border-cocoa-100 pb-2">
        <dt className="text-cocoa-500">Payment method</dt>
        <dd className="font-semibold capitalize text-cocoa-900">{order.payment_method.replace("_", " ")}</dd>
      </div>
      <div className="flex justify-between border-b border-cocoa-100 pb-2">
        <dt className="text-cocoa-500">Payment status</dt>
        <dd className="font-semibold text-cocoa-900">{order.payment_status.replace("_", " ")}</dd>
      </div>
      <div className="flex justify-between border-b border-cocoa-100 pb-2">
        <dt className="text-cocoa-500">Requested date</dt>
        <dd className="font-semibold text-cocoa-900">{order.requested_date ?? "—"}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-cocoa-500">Fulfilment</dt>
        <dd className="font-semibold capitalize text-cocoa-900">{order.fulfillment_type}</dd>
      </div>
    </dl>
  );
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;

  return (
    <div className="container-page flex min-h-[60vh] items-center py-10">
      <div className="card mx-auto w-full max-w-md p-10 text-center">
        <div className="text-5xl" aria-hidden="true">✅</div>
        <h1 className="mt-4 font-display text-2xl font-bold text-cocoa-900">Order received!</h1>
        <p className="mt-2 text-sm text-cocoa-600">
          Thank you for ordering from Jrubiecakes. We&apos;ve sent a confirmation email with your
          order details.
        </p>

        {orderNumber ? (
          <Suspense fallback={<div className="skeleton mx-auto mt-5 h-40 w-full max-w-sm" />}>
            <OrderSummary orderNumber={orderNumber} />
          </Suspense>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          <Link href="/shop" className="btn-primary">Continue Shopping</Link>
          <Link href="/contact" className="btn-ghost">Questions? Contact Us</Link>
        </div>
      </div>
    </div>
  );
}
