"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@/types";
import { saveProduct } from "@/lib/admin-actions";

export function ProductForm({
  categories,
  product,
}: {
  categories: Category[];
  product?: Product | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData(e.currentTarget);
      const id = await saveProduct(formData);
      setSuccess(true);
      if (!product) {
        router.push(`/admin/products/${id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-name" className="label">Product name *</label>
          <input
            id="pf-name"
            name="name"
            type="text"
            required
            minLength={2}
            defaultValue={product?.name ?? ""}
            className="input"
            placeholder="e.g. Custom Birthday Cake"
          />
        </div>
        <div>
          <label htmlFor="pf-slug" className="label">Slug <span className="text-cocoa-400">(optional — auto-generated)</span></label>
          <input
            id="pf-slug"
            name="slug"
            type="text"
            defaultValue={product?.slug ?? ""}
            className="input"
            placeholder="custom-birthday-cake"
          />
        </div>
      </div>

      <div>
        <label htmlFor="pf-category" className="label">Category *</label>
        <select
          id="pf-category"
          name="categoryId"
          required
          defaultValue={product?.category_id ?? ""}
          className="input"
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pf-description" className="label">Description</label>
        <textarea
          id="pf-description"
          name="description"
          rows={4}
          defaultValue={product?.description ?? ""}
          className="input"
          placeholder="Describe the product, flavours and what's included…"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="pf-price" className="label">Price (₦) *</label>
          <input
            id="pf-price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={product?.price ?? ""}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="pf-saleprice" className="label">Sale price (₦)</label>
          <input
            id="pf-saleprice"
            name="salePrice"
            type="number"
            min={0}
            step="0.01"
            defaultValue={product?.sale_price ?? ""}
            className="input"
            placeholder="Leave empty for no sale"
          />
        </div>
        <div>
          <label htmlFor="pf-minqty" className="label">Min. order quantity</label>
          <input
            id="pf-minqty"
            name="minOrderQuantity"
            type="number"
            min={1}
            defaultValue={product?.min_order_quantity ?? 1}
            className="input"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-stock" className="label">Stock quantity <span className="text-cocoa-400">(optional)</span></label>
          <input
            id="pf-stock"
            name="stockQuantity"
            type="number"
            min={0}
            defaultValue={product?.stock_quantity ?? ""}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="pf-prep" className="label">Preparation time (hours)</label>
          <input
            id="pf-prep"
            name="prepTimeHours"
            type="number"
            min={0}
            defaultValue={product?.prep_time_hours ?? ""}
            className="input"
            placeholder="e.g. 48"
          />
        </div>
      </div>

      <fieldset className="rounded-2xl bg-cream-100 p-4">
        <legend className="px-2 text-sm font-semibold text-cocoa-800">Availability &amp; flags</legend>
        <div className="mt-2 space-y-3">
          <label className="flex items-center gap-3 text-sm text-cocoa-700">
            <input
              type="checkbox"
              name="isAvailable"
              defaultChecked={product ? product.is_available : true}
              className="h-4 w-4 rounded border-cocoa-300"
            />
            Available for ordering
          </label>
          <label className="flex items-center gap-3 text-sm text-cocoa-700">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={product?.is_featured ?? false}
              className="h-4 w-4 rounded border-cocoa-300"
            />
            Feature on homepage
          </label>
          <label className="flex items-center gap-3 text-sm text-cocoa-700">
            <input
              type="checkbox"
              name="isCustomizable"
              defaultChecked={product?.is_customizable ?? false}
              className="h-4 w-4 rounded border-cocoa-300"
            />
            Customizable (shows customization interface)
          </label>
        </div>
      </fieldset>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">Saved successfully.</p>}

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Saving…" : product ? "Save Changes" : "Create Product"}
      </button>
    </form>
  );
}
