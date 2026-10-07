"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart, useToast } from "@/components/providers";
import { formatPriceNaira } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Product, ProductOption } from "@/types";

type Step = { id: string; title: string; hint?: string };

const STEPS: Step[] = [
  { id: "type", title: "Cake type", hint: "What are we celebrating?" },
  { id: "size", title: "Size", hint: "How many people will it serve?" },
  { id: "flavour", title: "Flavour" },
  { id: "filling", title: "Filling & frosting" },
  { id: "design", title: "Design", hint: "Theme, colours and message" },
  { id: "reference", title: "Reference image", hint: "Optional — show us your inspiration" },
  { id: "date", title: "Date", hint: "When do you need it?" },
  { id: "instructions", title: "Special instructions" },
  { id: "review", title: "Review" },
];

function findOption(options: ProductOption[], name: string): ProductOption | undefined {
  return options.find((o) => o.name === name);
}

export function CustomCakeWizard({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const showToast = useToast();

  const options: ProductOption[] = useMemo(
    () => [...(product.product_options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [product]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // selections keyed by option id
  const [selection, setSelection] = useState<Record<string, { valueId?: string; textValue?: string }>>({});
  const [reference, setReference] = useState<{ path: string; previewUrl: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const opt = {
    type: findOption(options, "Cake type"),
    size: findOption(options, "Cake size"),
    flavour: findOption(options, "Flavour"),
    filling: findOption(options, "Filling"),
    frosting: findOption(options, "Frosting"),
    theme: findOption(options, "Theme"),
    themeDesc: findOption(options, "Theme description"),
    colour: findOption(options, "Cake colour"),
    message: findOption(options, "Message on cake"),
    topper: findOption(options, "Cake topper"),
    refImage: findOption(options, "Reference image link"),
    instructions: findOption(options, "Special instructions"),
    date: findOption(options, "Requested date"),
  };

  const unitPrice = product.sale_price && product.sale_price < product.price ? product.sale_price : product.price;

  const optionsDelta = useMemo(() => {
    let delta = 0;
    for (const o of options) {
      const sel = selection[o.id];
      if (!sel?.valueId) continue;
      const val = o.product_option_values?.find((v) => v.id === sel.valueId);
      if (val) delta += val.price_delta;
    }
    return delta;
  }, [options, selection]);

  // ---------- date guard: respect the bakery's configured prep time ----------
  const leadDays = Math.max(1, Math.ceil((product.prep_time_hours ?? 48) / 24));
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + leadDays);
    return d.toISOString().slice(0, 10);
  }, [leadDays]);

  // ---------- step validation ----------
  const valueOf = (o?: ProductOption) => (o ? selection[o.id] : undefined);

  const stepValid = (i: number): boolean => {
    switch (STEPS[i].id) {
      case "type": return !!valueOf(opt.type)?.valueId;
      case "size": return !!valueOf(opt.size)?.valueId;
      case "flavour": return !!valueOf(opt.flavour)?.valueId;
      case "filling":
        return (!opt.frosting || !!valueOf(opt.frosting)?.valueId); // filling optional
      case "design":
        return true; // theme fields optional; bakers fill gaps via instructions
      case "reference": return true; // optional
      case "date": return !!valueOf(opt.date)?.textValue && valueOf(opt.date)!.textValue! >= minDate;
      case "instructions": return true;
      default: return true;
    }
  };

  function next() {
    if (!stepValid(stepIndex)) {
      setError("Please make a selection to continue.");
      return;
    }
    setError(null);
    setStepIndex((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function back() {
    setError(null);
    setStepIndex((s) => Math.max(0, s - 1));
  }

  // ---------- upload ----------
  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/custom-cake/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 401) {
        setError("Please sign in to upload a reference image. You can still continue without one.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setReference({ path: data.path, previewUrl: data.previewUrl });
      if (opt.refImage) {
        setSelection((s) => ({ ...s, [opt.refImage!.id]: { textValue: data.path } }));
      }
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  // ---------- add to cart ----------
  function addToCart() {
    setBusy(true);
    try {
      const display: { optionName: string; value: string; priceDelta: number }[] = [];
      const refs: { optionId: string; valueId: string | null; textValue?: string }[] = [];

      for (const o of options) {
        const sel = selection[o.id];
        if (!sel) continue;
        if (sel.valueId) {
          const val = o.product_option_values?.find((v) => v.id === sel.valueId);
          if (!val) continue;
          display.push({ optionName: o.name, value: val.value, priceDelta: Math.round(val.price_delta * 100) });
          refs.push({ optionId: o.id, valueId: sel.valueId });
        } else if (sel.textValue?.trim()) {
          display.push({ optionName: o.name, value: sel.textValue.trim(), priceDelta: 0 });
          refs.push({ optionId: o.id, valueId: null, textValue: sel.textValue.trim() });
        }
      }

      addItem({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        imageUrl: "/products/birthday-cake.png",
        unitPrice: Math.round((unitPrice + optionsDelta) * 100),
        quantity: 1,
        options: display,
        optionRefs: refs,
      });

      showToast("Custom cake added to cart");
      router.push("/cart");
    } finally {
      setBusy(false);
    }
  }

  const current = STEPS[stepIndex];

  const selectButtons = (o?: ProductOption) =>
    !o ? null : (
      <div className="flex flex-wrap gap-2">
        {o.product_option_values?.map((val) => {
          const selected = selection[o.id]?.valueId === val.id;
          return (
            <button
              key={val.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelection((s) => ({ ...s, [o.id]: { valueId: val.id } }))}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                selected
                  ? "border-cocoa-800 bg-cocoa-800 text-cream-50"
                  : "border-cocoa-200 bg-white text-cocoa-700 hover:border-cocoa-400"
              )}
            >
              {val.value}
              {val.price_delta > 0 && <span className="ml-1.5 text-cocoa-400">+{formatPriceNaira(val.price_delta)}</span>}
            </button>
          );
        })}
      </div>
    );

  const textInput = (o?: ProductOption, placeholder = "") =>
    !o ? null : (
      <input
        id={`cc-${o.id}`}
        type="text"
        className="input"
        placeholder={placeholder}
        value={selection[o.id]?.textValue ?? ""}
        onChange={(e) => setSelection((s) => ({ ...s, [o.id]: { textValue: e.target.value } }))}
      />
    );

  const multilineInput = (o?: ProductOption, placeholder = "") =>
    !o ? null : (
      <textarea
        id={`cc-${o.id}`}
        rows={3}
        className="input"
        placeholder={placeholder}
        value={selection[o.id]?.textValue ?? ""}
        onChange={(e) => setSelection((s) => ({ ...s, [o.id]: { textValue: e.target.value } }))}
      />
    );

  const dateInput = (o?: ProductOption) =>
    !o ? null : (
      <>
        <input
          id={`cc-${o.id}`}
          type="date"
          min={minDate}
          className="input sm:!w-auto"
          value={selection[o.id]?.textValue ?? ""}
          onChange={(e) => setSelection((s) => ({ ...s, [o.id]: { textValue: e.target.value } }))}
        />
        <p className="mt-1.5 text-xs text-cocoa-500">
          Custom cakes need {leadDays} day{leadDays === 1 ? "" : "s"} to prepare — earliest date is {minDate}.
        </p>
      </>
    );

  function reviewRows(): [string, string][] {
    const val = (o?: ProductOption) => {
      const sel = valueOf(o);
      if (!sel) return null;
      if (sel.valueId) return o!.product_option_values?.find((v) => v.id === sel.valueId)?.value ?? null;
      return sel.textValue?.trim() || null;
    };
    const rows: [string, string][] = [];
    const push = (label: string, v: string | null | undefined) => { if (v) rows.push([label, v]); };
    push("Cake type", val(opt.type));
    push("Size", val(opt.size));
    push("Flavour", val(opt.flavour));
    push("Filling", val(opt.filling));
    push("Frosting", val(opt.frosting));
    push("Theme", val(opt.theme));
    push("Theme description", val(opt.themeDesc));
    push("Colour", val(opt.colour));
    push("Message", val(opt.message));
    push("Topper", val(opt.topper));
    push("Requested date", val(opt.date));
    push("Special instructions", val(opt.instructions));
    push("Reference image", reference ? "Uploaded ✓" : null);
    return rows;
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <ol className="mb-8 flex flex-wrap items-center gap-1.5 text-[11px] text-cocoa-400" aria-label="Wizard progress">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span
              aria-current={i === stepIndex ? "step" : undefined}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full font-bold",
                i < stepIndex ? "bg-cocoa-700 text-cream-50" : i === stepIndex ? "bg-blush-500 text-white" : "bg-cocoa-100"
              )}
            >
              {i < stepIndex ? "✓" : i + 1}
            </span>
            <span className={cn("hidden sm:inline", i === stepIndex && "font-semibold text-cocoa-800")}>{s.title}</span>
            {i < STEPS.length - 1 && <span aria-hidden="true" className="px-0.5">·</span>}
          </li>
        ))}
      </ol>

      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-cocoa-900">{current.title}</h1>
        {current.hint && <p className="mt-1 text-sm text-cocoa-500">{current.hint}</p>}

        <div className="mt-6 space-y-5">
          {current.id === "type" && selectButtons(opt.type)}
          {current.id === "size" && selectButtons(opt.size)}
          {current.id === "flavour" && selectButtons(opt.flavour)}
          {current.id === "filling" && (
            <>
              {selectButtons(opt.frosting)}
              {selectButtons(opt.filling)}
            </>
          )}

          {current.id === "design" && (
            <>
              {textInput(opt.theme, "e.g. Princess castle, football, flowers…")}
              {multilineInput(opt.themeDesc, "Describe the theme or character in your own words…")}
              {textInput(opt.colour, "e.g. Pink and gold")}
              {textInput(opt.message, 'e.g. "Happy Birthday Ada"')}
              {selectButtons(opt.topper)}
            </>
          )}

          {current.id === "reference" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                  e.target.value = "";
                }}
              />
              {reference?.previewUrl ? (
                <div className="flex items-center gap-4">
                  <Image
                    src={reference.previewUrl}
                    alt="Your reference image"
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded-2xl border border-cocoa-100 object-cover"
                    unoptimized
                  />
                  <button type="button" onClick={() => { setReference(null); if (opt.refImage) setSelection((s) => ({ ...s, [opt.refImage!.id]: { textValue: "" } })); }}
                    className="text-xs font-semibold text-red-500 hover:text-red-700">
                    Remove image
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-outline w-full"
                >
                  {uploading ? "Uploading…" : "📷 Choose an image (PNG/JPG, max 5 MB)"}
                </button>
              )}
              <p className="mt-2 text-xs text-cocoa-400">Optional — skip if you don&apos;t have one.</p>
            </div>
          )}

          {current.id === "date" && dateInput(opt.date)}

          {current.id === "instructions" && multilineInput(opt.instructions, "Allergies, delivery details, anything else we should know…")}

          {current.id === "review" && (
            <>
              <dl className="space-y-2 rounded-2xl bg-cream-100 p-5 text-sm">
                {reviewRows().map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-cocoa-500">{k}</dt>
                    <dd className="max-w-[60%] text-right font-medium text-cocoa-900">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-cocoa-200 pt-2 text-base font-bold text-cocoa-900">
                  <dt>Total</dt>
                  <dd>{formatPriceNaira(unitPrice + optionsDelta)}</dd>
                </div>
              </dl>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-8 flex gap-3">
          {stepIndex > 0 && (
            <button type="button" onClick={back} disabled={busy} className="btn-outline">
              Back
            </button>
          )}
          {stepIndex < STEPS.length - 1 ? (
            <button type="button" onClick={next} disabled={busy || uploading} className="btn-primary flex-1">
              Continue
            </button>
          ) : (
            <button type="button" onClick={addToCart} disabled={busy} className="btn-blush flex-1">
              {busy ? "Adding…" : "Add to Cart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
