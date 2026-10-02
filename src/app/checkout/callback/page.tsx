"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function CallbackInner() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const [state, setState] = useState<"verifying" | "success" | "failed" | "pending">("verifying");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!reference) {
      setState("failed");
      setMessage("No payment reference found.");
      return;
    }

    fetch(`/api/payments/paystack/verify?reference=${encodeURIComponent(reference)}`)
      .then(async (res) => {
        const data = await res.json();
        setOrderNumber(data.orderNumber ?? null);
        if (!res.ok) {
          setState("failed");
          setMessage(data.error ?? "Payment verification failed");
          return;
        }
        if (data.status === "success") {
          setState("success");
        } else if (data.status === "failed" || data.status === "reversed") {
          setState("failed");
          setMessage("The payment was not completed.");
        } else if (data.status === "abandoned") {
          setState("failed");
          setMessage(
            "The payment was cancelled or left unfinished. You can place the order again — you were not charged."
          );
        } else {
          setState("pending");
          setMessage("Your payment is still processing. We'll update your order once it goes through.");
        }
      })
      .catch(() => {
        setState("failed");
        setMessage("Could not verify payment. Check your connection and try again.");
      });
  }, [reference]);

  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      {state === "verifying" && (
        <>
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-cocoa-100 border-t-cocoa-700" aria-hidden="true" />
          <h1 className="mt-6 font-display text-xl font-bold text-cocoa-900">Verifying your payment…</h1>
          <p className="mt-2 text-sm text-cocoa-500">This only takes a moment.</p>
        </>
      )}

      {state === "success" && (
        <>
          <div className="text-5xl" aria-hidden="true">🎉</div>
          <h1 className="mt-4 font-display text-2xl font-bold text-cocoa-900">Payment successful!</h1>
          <p className="mt-2 text-sm text-cocoa-600">
            Thank you! We&apos;ve received your payment{orderNumber ? ` for order ${orderNumber}` : ""}.
            A confirmation email is on its way, and your order is now being prepared.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {orderNumber && (
              <Link href={`/orders/${orderNumber}`} className="btn-primary">View Order Status</Link>
            )}
            <Link href="/shop" className="btn-ghost">Continue Shopping</Link>
          </div>
        </>
      )}

      {(state === "failed" || state === "pending") && (
        <>
          <div className="text-5xl" aria-hidden="true">{state === "failed" ? "😕" : "⏳"}</div>
          <h1 className="mt-4 font-display text-2xl font-bold text-cocoa-900">
            {state === "failed" ? "Payment not completed" : "Payment pending"}
          </h1>
          <p className="mt-2 text-sm text-cocoa-600">{message}</p>
          {orderNumber && (
            <p className="mt-1 text-xs text-cocoa-400">Order reference: {orderNumber}</p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/shop" className="btn-primary">Back to Shop</Link>
            <Link href="/contact" className="btn-ghost">Contact Support</Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function PaystackCallbackPage() {
  return (
    <div className="container-page flex min-h-[60vh] items-center py-10">
      <Suspense fallback={<div className="skeleton mx-auto h-72 w-full max-w-md" />}>
        <CallbackInner />
      </Suspense>
    </div>
  );
}
