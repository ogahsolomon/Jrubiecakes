import Link from "next/link";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductForm } from "@/components/admin/product-form";
import { ResilientImage } from "@/components/ui/resilient-image";
import {
  addProductImage,
  setPrimaryImage,
  deleteProductImage,
  saveProductOption,
  deleteProductOption,
} from "@/lib/admin-actions";
import type { Product } from "@/types";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const [productRes, categoriesRes] = await Promise.all([
    admin
      .from("products")
      .select(`
        *,
        product_images (id, url, alt_text, sort_order),
        product_options (
          id, product_id, name, type, is_required, sort_order,
          product_option_values (id, option_id, value, price_delta, sort_order)
        )
      `)
      .eq("id", id)
      .single(),
    admin.from("categories").select("*").eq("is_active", true).order("sort_order"),
  ]);

  if (!productRes.data) notFound();
  const product = productRes.data as Product;
  const images = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const options = [...(product.product_options ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="max-w-4xl">
      <nav aria-label="Breadcrumb" className="text-xs text-cocoa-500">
        <Link href="/admin/products" className="hover:text-cocoa-700">Products</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-cocoa-800">{product.name}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-cocoa-900">Edit: {product.name}</h1>
        <Link href={`/product/${product.slug}`} className="btn-ghost !py-2 !text-xs" target="_blank">
          View on store ↗
        </Link>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Basics */}
        <section className="card h-fit p-6" aria-labelledby="basics">
          <h2 id="basics" className="font-display text-lg font-bold text-cocoa-900">Product details</h2>
          <div className="mt-4">
            <ProductForm categories={categoriesRes.data ?? []} product={product} />
          </div>
        </section>

        <div className="space-y-6">
          {/* Images */}
          <section className="card p-6" aria-labelledby="images">
            <h2 id="images" className="font-display text-lg font-bold text-cocoa-900">Images</h2>

            {images.length > 0 ? (
              <ul className="mt-4 grid grid-cols-2 gap-3">
                {images.map((img, i) => (
                  <li key={img.id} className="overflow-hidden rounded-xl border border-cocoa-100 bg-cream-50">
                    <div className="relative aspect-[4/3] bg-cocoa-100">
                      <ResilientImage src={img.url} alt={img.alt_text ?? ""} fill className="object-cover object-top" sizes="200px" />
                      {i === 0 && (
                        <span className="absolute left-2 top-2 badge bg-cocoa-800 text-cream-50">Primary</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 p-2">
                      {i !== 0 ? (
                        <form action={setPrimaryImage}>
                          <input type="hidden" name="imageId" value={img.id} />
                          <input type="hidden" name="productId" value={product.id} />
                          <button type="submit" className="text-xs font-semibold text-cocoa-600 hover:text-cocoa-900">
                            Make primary
                          </button>
                        </form>
                      ) : (
                        <span />
                      )}
                      <form action={deleteProductImage}>
                        <input type="hidden" name="imageId" value={img.id} />
                        <input type="hidden" name="productId" value={product.id} />
                        <button type="submit" className="text-xs font-semibold text-red-500 hover:text-red-700">
                          Delete
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-cocoa-400">No images yet — add one below.</p>
            )}

            <form action={addProductImage} className="mt-5 space-y-3 rounded-2xl bg-cream-100 p-4">
              <input type="hidden" name="productId" value={product.id} />
              <div>
                <label htmlFor="img-file" className="label">Upload image (PNG/JPG/WebP, max 5MB)</label>
                <input
                  id="img-file"
                  name="file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full text-sm text-cocoa-600 file:mr-3 file:rounded-full file:border-0 file:bg-cocoa-700 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-cream-50 hover:file:bg-cocoa-800"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="img-url" className="label">…or paste an image URL</label>
                  <input id="img-url" name="url" type="url" className="input" placeholder="https://…" />
                </div>
                <div>
                  <label htmlFor="img-alt" className="label">Alt text</label>
                  <input id="img-alt" name="altText" type="text" className="input" placeholder="Describe the image" />
                </div>
              </div>
              <button type="submit" className="btn-primary !py-2.5 !text-xs">Add Image</button>
            </form>
          </section>

          {/* Options */}
          <section className="card p-6" aria-labelledby="options">
            <h2 id="options" className="font-display text-lg font-bold text-cocoa-900">
              Customization options
            </h2>
            <p className="mt-1 text-xs text-cocoa-500">
              Configure per-product options customers must choose (e.g. cake size, flavour, message).
            </p>

            {options.length > 0 && (
              <ul className="mt-4 space-y-3">
                {options.map((opt) => (
                  <li key={opt.id} className="rounded-xl border border-cocoa-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-cocoa-900">{opt.name}</p>
                        <p className="text-xs text-cocoa-500">
                          {opt.type} {opt.is_required ? "· required" : "· optional"}
                        </p>
                      </div>
                      <form action={deleteProductOption}>
                        <input type="hidden" name="optionId" value={opt.id} />
                        <input type="hidden" name="productId" value={product.id} />
                        <button type="submit" className="text-xs font-semibold text-red-500 hover:text-red-700">
                          Remove
                        </button>
                      </form>
                    </div>
                    {opt.product_option_values && opt.product_option_values.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {opt.product_option_values.map((v) => (
                          <span key={v.id} className="badge bg-cocoa-100 text-cocoa-600">
                            {v.value}
                            {v.price_delta > 0 ? ` (+₦${v.price_delta.toLocaleString()})` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form action={saveProductOption} className="mt-5 space-y-3 rounded-2xl bg-cream-100 p-4">
              <input type="hidden" name="productId" value={product.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="opt-name" className="label">Option name</label>
                  <input id="opt-name" name="name" type="text" required className="input" placeholder="e.g. Cake size" />
                </div>
                <div>
                  <label htmlFor="opt-type" className="label">Input type</label>
                  <select id="opt-type" name="type" className="input" defaultValue="select">
                    <option value="select">Choice (select)</option>
                    <option value="text">Short text</option>
                    <option value="multiline">Long text</option>
                    <option value="date">Date</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="opt-values" className="label">
                  Choices <span className="text-cocoa-400">(one per line; add +₦ delta with &quot;8 inch:8000&quot;)</span>
                </label>
                <textarea
                  id="opt-values"
                  name="values"
                  rows={3}
                  className="input"
                  placeholder={"6 inch\n8 inch:8000\n10 inch:15000"}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-cocoa-700">
                <input type="checkbox" name="isRequired" className="h-4 w-4 rounded border-cocoa-300" />
                Required — customer must choose
              </label>
              <button type="submit" className="btn-primary !py-2.5 !text-xs">Add Option</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
