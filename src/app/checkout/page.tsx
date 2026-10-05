"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";

import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers";
import { ResilientImage } from "@/components/ui/resilient-image";
import { formatNGN } from "@/lib/money";
import { NIGERIAN_STATES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type PaymentOptions = { paystack: boolean; bank_transfer: boolean; cash: boolean };
type BankDetails = { bankName: string; accountNumber: string; accountName: string };

const STEPS = ["Customer", "Delivery", "Details", "Payment"] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 sm:flex-nowrap" aria-label="Checkout progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              i < current
                ? "bg-cocoa-700 text-cream-50"
                : i === current
                ? "bg-blush-500 text-white"
                : "bg-cocoa-100 text-cocoa-400"
            )}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span
            className={cn(
              "text-xs font-medium",
              i === current ? "text-cocoa-900" : "text-cocoa-400"
            )}
          >
            {/* Label collapses to initials on the narrowest screens so the row never overflows */}
            <span className="sm:hidden">{label.slice(0, 3)}</span>
            <span className="hidden sm:inline">{label}</span>
          </span>
          {i < STEPS.length - 1 && (
            <span className="mx-1 hidden h-px w-4 bg-cocoa-200 sm:block" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Step 1: customer
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2: delivery
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [landmark, setLandmark] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");

  // Step 3: order details
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [notes, setNotes] = useState("");

  // Step 4: payment
  const [paymentMethod, setPaymentMethod] = useState<"paystack" | "bank_transfer" | "cash">("paystack");
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions>({ paystack: true, bank_transfer: true, cash: true });
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);

  // Prefill + load settings
  useEffect(() => {
    async function load() {
      try {
        const [poRes, bdRes] = await Promise.all([
          fetch("/api/settings/payment-options").then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/settings/bank-details").then((r) => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (poRes) setPaymentOptions(poRes);
        if (bdRes?.accountNumber) setBankDetails(bdRes);
      } catch {
        // defaults are fine
      }
    }
    load();
  }, []);

  // Load delivery fee when state selected
  useEffect(() => {
    if (fulfillmentType !== "delivery" || !stateRegion) {
      setDeliveryFee(null);
      return;
    }
    fetch(`/api/settings/delivery-fee?state=${encodeURIComponent(stateRegion)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDeliveryFee(typeof d?.fee === "number" ? d.fee : null))
      .catch(() => setDeliveryFee(null));
  }, [fulfillmentType, stateRegion]);

  const minDate = new Date().toISOString().slice(0, 10);

  function validateStep(current: number): boolean {
    const errs: Record<string, string> = {};
    if (current === 0) {
      if (fullName.trim().length < 2) errs.fullName = "Full name is required";
      if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = "Enter a valid email address";
      if (!/^(\+?234|0)[789][01]\d{8}$/.test(phone.replace(/\s/g, "")))
        errs.phone = "Enter a valid Nigerian phone (e.g. 08031234567)";
    }
    if (current === 1 && fulfillmentType === "delivery") {
      if (addressLine.trim().length < 5) errs.addressLine = "Delivery address is required";
      if (!city.trim()) errs.city = "City is required";
      if (!stateRegion) errs.state = "State is required";
    }
    if (current === 2) {
      if (!requestedDate) errs.requestedDate = "Choose a date";
      else if (requestedDate < minDate) errs.requestedDate = "Date cannot be in the past";
    }
    if (current === 3 && !paymentOptions[paymentMethod]) {
      errs.paymentMethod = "This payment method is unavailable";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0 });
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0 });
  }

  async function submitOrder() {
    if (!validateStep(3)) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout: {
            customer: { fullName, email, phone: phone.replace(/\s/g, "") },
            delivery: {
              fulfillmentType,
              addressLine: fulfillmentType === "delivery" ? addressLine : undefined,
              city: fulfillmentType === "delivery" ? city : undefined,
              state: fulfillmentType === "delivery" ? stateRegion : undefined,
              landmark: fulfillmentType === "delivery" ? landmark || undefined : undefined,
              deliveryInstructions: deliveryInstructions || undefined,
            },
            orderDetails: { requestedDate, requestedTime: requestedTime || undefined, notes: notes || undefined },
            paymentMethod,
          },
          cart: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            options: i.optionRefs ?? [],
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Map server field errors
        if (data.field) setFieldErrors({ [data.field.split(".").pop() ?? ""]: data.error });
        setError(data.error ?? "Could not place your order");
        setBusy(false);
        return;
      }

      clearCart();

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }

      router.push(`/checkout/success?order=${encodeURIComponent(data.orderNumber)}`);
    } catch {
      setError("Network error — please check your connection and try again.");
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-md p-10 text-center">
        <div className="text-5xl" aria-hidden="true">🛒</div>
        <h1 className="mt-4 font-display text-xl font-bold text-cocoa-900">Your cart is empty</h1>
        <p className="mt-2 text-sm text-cocoa-500">Add some treats before checking out.</p>
        <Link href="/shop" className="btn-primary mt-6">Browse Treats</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <StepIndicator current={step} />

        {/* Step 0: Customer */}
        {step === 0 && (
          <section className="mt-8 space-y-4" aria-label="Customer information">
            <h2 className="font-display text-xl font-bold text-cocoa-900">Customer information</h2>
            <div>
              <label htmlFor="co-name" className="label">Full name</label>
              <input id="co-name" type="text" autoComplete="name" className="input" value={fullName}
                onChange={(e) => setFullName(e.target.value)} aria-invalid={!!fieldErrors.fullName} />
              {fieldErrors.fullName && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>}
            </div>
            <div>
              <label htmlFor="co-email" className="label">Email</label>
              <input id="co-email" type="email" autoComplete="email" className="input" value={email}
                onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldErrors.email}
                aria-describedby="co-email-hint" />
              <p id="co-email-hint" className="mt-1 text-xs text-cocoa-400">Order updates and receipts are sent here</p>
              {fieldErrors.email && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>
            <div>
              <label htmlFor="co-phone" className="label">Phone number (WhatsApp preferred)</label>
              <input id="co-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0803 123 4567"
                className="input" value={phone} onChange={(e) => setPhone(e.target.value)}
                aria-invalid={!!fieldErrors.phone} aria-describedby="co-phone-hint" />
              <p id="co-phone-hint" className="mt-1 text-xs text-cocoa-400">Format: 08031234567 or +2348031234567</p>
              {fieldErrors.phone && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
            </div>
          </section>
        )}

        {/* Step 1: Delivery */}
        {step === 1 && (
          <section className="mt-8 space-y-4" aria-label="Delivery information">
            <h2 className="font-display text-xl font-bold text-cocoa-900">Delivery information</h2>
            <fieldset>
              <legend className="label">How would you like to receive your order?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["delivery", "pickup"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setFulfillmentType(t)} aria-pressed={fulfillmentType === t}
                    className={cn("rounded-2xl border-2 p-4 text-left transition-colors",
                      fulfillmentType === t ? "border-cocoa-700 bg-cream-100" : "border-cocoa-200 bg-white")}>
                    <span className="block text-sm font-bold text-cocoa-900">
                      {t === "delivery" ? "🛵 Delivery" : "🏪 Pickup"}
                    </span>
                    <span className="mt-0.5 block text-xs text-cocoa-500">
                      {t === "delivery" ? "Delivered to your address" : "Collect from our bakery"}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {fulfillmentType === "delivery" ? (
              <>
                <div>
                  <label htmlFor="co-address" className="label">Street address</label>
                  <input id="co-address" type="text" autoComplete="street-address" className="input" value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)} aria-invalid={!!fieldErrors.addressLine} />
                  {fieldErrors.addressLine && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.addressLine}</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="co-city" className="label">City</label>
                    <input id="co-city" type="text" autoComplete="address-level2" className="input" value={city}
                      onChange={(e) => setCity(e.target.value)} aria-invalid={!!fieldErrors.city} />
                    {fieldErrors.city && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.city}</p>}
                  </div>
                  <div>
                    <label htmlFor="co-state" className="label">State</label>
                    <select id="co-state" className="input" value={stateRegion}
                      onChange={(e) => setStateRegion(e.target.value)} aria-invalid={!!fieldErrors.state}>
                      <option value="">Select state…</option>
                      {NIGERIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {fieldErrors.state && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.state}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="co-landmark" className="label">Landmark <span className="text-cocoa-400">(optional)</span></label>
                  <input id="co-landmark" type="text" className="input" value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. opposite First Bank" />
                </div>
                <div>
                  <label htmlFor="co-dinstruct" className="label">Delivery instructions <span className="text-cocoa-400">(optional)</span></label>
                  <textarea id="co-dinstruct" rows={2} className="input" value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder="e.g. call when you arrive at the gate" />
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-cream-100 p-4 text-sm text-cocoa-600">
                We&apos;ll send you the pickup address and opening hours once your order is confirmed.
              </div>
            )}
          </section>
        )}

        {/* Step 2: Order details */}
        {step === 2 && (
          <section className="mt-8 space-y-4" aria-label="Order details">
            <h2 className="font-display text-xl font-bold text-cocoa-900">When do you need it?</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="co-date" className="label">Requested {fulfillmentType === "delivery" ? "delivery" : "pickup"} date</label>
                <input id="co-date" type="date" min={minDate} className="input" value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)} aria-invalid={!!fieldErrors.requestedDate} />
                {fieldErrors.requestedDate && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.requestedDate}</p>}
              </div>
              <div>
                <label htmlFor="co-time" className="label">Preferred time <span className="text-cocoa-400">(optional)</span></label>
                <input id="co-time" type="time" className="input" value={requestedTime}
                  onChange={(e) => setRequestedTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="co-notes" className="label">Special instructions <span className="text-cocoa-400">(optional)</span></label>
              <textarea id="co-notes" rows={3} className="input" value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, colour preferences, inscription details…" />
            </div>
            <p className="rounded-2xl bg-blush-50 px-4 py-3 text-xs leading-relaxed text-blush-700">
              🕒 Custom cakes need at least 48 hours&apos; notice. We&apos;ll confirm availability after your order comes in.
            </p>
          </section>
        )}

        {/* Step 3: Payment */}
        {step === 3 && (
          <section className="mt-8 space-y-4" aria-label="Payment method">
            <h2 className="font-display text-xl font-bold text-cocoa-900">Payment method</h2>
            <div className="space-y-3">
              {(
                [
                  ["paystack", "Pay Online", "Secure card, transfer or USSD via Paystack", "💳"],
                  ["bank_transfer", "Bank Transfer", "Pay into our account and send us the receipt", "🏦"],
                  ["cash", "Cash on Delivery/Pickup", "Pay cash when you receive your order", "💵"],
                ] as const
              )
                .filter(([id]) => paymentOptions[id])
                .map(([id, title, desc, icon]) => (
                  <button key={id} type="button" onClick={() => setPaymentMethod(id)}
                    aria-pressed={paymentMethod === id}
                    className={cn("flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
                      paymentMethod === id ? "border-cocoa-700 bg-cream-100" : "border-cocoa-200 bg-white")}>
                    <span className="text-2xl" aria-hidden="true">{icon}</span>
                    <span>
                      <span className="block text-sm font-bold text-cocoa-900">{title}</span>
                      <span className="block text-xs text-cocoa-500">{desc}</span>
                    </span>
                  </button>
                ))}
            </div>
            {fieldErrors.paymentMethod && <p role="alert" className="text-xs text-red-600">{fieldErrors.paymentMethod}</p>}

            {paymentMethod === "bank_transfer" && (
              <div className="rounded-2xl bg-cream-100 p-5">
                <h3 className="text-sm font-bold text-cocoa-900">Transfer details</h3>
                {bankDetails?.accountNumber ? (
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-cocoa-500">Bank</dt><dd className="font-semibold">{bankDetails.bankName}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-cocoa-500">Account number</dt><dd className="font-semibold">{bankDetails.accountNumber}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-cocoa-500">Account name</dt><dd className="font-semibold">{bankDetails.accountName}</dd></div>
                  </dl>
                ) : (
                  <p className="mt-2 text-xs text-cocoa-500">
                    Bank details will be shown on your order confirmation email.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button type="button" onClick={back} disabled={busy} className="btn-outline">
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="btn-primary flex-1">
              Continue
            </button>
          ) : (
            <button type="button" onClick={submitOrder} disabled={busy} className="btn-blush flex-1">
              {busy ? "Placing order…" : `Place Order · ${formatNGN(subtotal + (deliveryFee ?? 0))}`}
            </button>
          )}
        </div>
      </div>

      {/* Order summary sidebar */}
      <aside className="h-fit rounded-2xl bg-white p-6 shadow-card lg:sticky lg:top-24" aria-label="Order summary">
        <h2 className="font-display text-lg font-bold text-cocoa-900">Order Summary</h2>
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.key} className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cocoa-100">
                <ResilientImage src={item.imageUrl} alt="" fill className="object-cover object-top" sizes="56px" fallbackEmoji="🍰" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-cocoa-900">{item.name}</p>
                {item.options.length > 0 && (
                  <p className="truncate text-xs text-cocoa-500">{item.options.map((o) => o.value).join(", ")}</p>
                )}
                <p className="text-xs text-cocoa-400">× {item.quantity}</p>
              </div>
              <span className="text-sm font-semibold text-cocoa-900">{formatNGN(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-cocoa-100 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-cocoa-600">Subtotal</dt>
            <dd className="font-semibold">{formatNGN(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-cocoa-600">Delivery fee</dt>
            <dd className="font-semibold">
              {fulfillmentType === "pickup"
                ? "Pickup — ₦0"
                : deliveryFee != null
                ? formatNGN(deliveryFee)
                : stateRegion ? "Checking…" : "Select state"}
            </dd>
          </div>
          <div className="flex justify-between border-t border-cocoa-100 pt-2 text-base">
            <dt className="font-bold text-cocoa-900">Total</dt>
            <dd className="font-bold text-cocoa-900">{formatNGN(subtotal + (deliveryFee ?? 0))}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-cocoa-400">
          Final total is confirmed securely on the server before payment.
        </p>
      </aside>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold text-cocoa-900">Checkout</h1>
      <div className="mt-8">
        <Suspense fallback={<div className="skeleton h-96 w-full" />}>
          <CheckoutInner />
        </Suspense>
      </div>
    </div>
  );
}
