import { createAdminClient } from "@/lib/supabase/admin";
import { saveCategory, deleteCategory } from "@/lib/admin-actions";
import type { Category } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const admin = createAdminClient();
  const { data: categories } = await admin
    .from("categories")
    .select("*")
    .order("sort_order");

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-cocoa-900">Categories</h1>
      <p className="mt-1 text-sm text-cocoa-500">Organise your catalogue into sections</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="existing-cats">
          <h2 id="existing-cats" className="font-display text-lg font-bold text-cocoa-900">
            Existing categories ({categories?.length ?? 0})
          </h2>
          <ul className="mt-4 space-y-3">
            {(categories ?? []).map((cat: Category) => (
              <li key={cat.id} className="rounded-xl border border-cocoa-100 p-4">
                <form action={saveCategory} className="space-y-3">
                  <input type="hidden" name="id" value={cat.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`cat-name-${cat.id}`} className="label !text-xs">Name</label>
                      <input id={`cat-name-${cat.id}`} name="name" type="text" defaultValue={cat.name} className="input !py-2 text-sm" required />
                    </div>
                    <div>
                      <label htmlFor={`cat-slug-${cat.id}`} className="label !text-xs">Slug</label>
                      <input id={`cat-slug-${cat.id}`} name="slug" type="text" defaultValue={cat.slug} className="input !py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor={`cat-desc-${cat.id}`} className="label !text-xs">Description</label>
                    <input id={`cat-desc-${cat.id}`} name="description" type="text" defaultValue={cat.description ?? ""} className="input !py-2 text-sm" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <label htmlFor={`cat-order-${cat.id}`} className="label !mb-0 !text-xs">Sort</label>
                        <input id={`cat-order-${cat.id}`} name="sortOrder" type="number" defaultValue={cat.sort_order} className="input !w-20 !py-1.5 text-sm" />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-cocoa-700">
                        <input type="checkbox" name="isActive" defaultChecked={cat.is_active} className="h-4 w-4 rounded border-cocoa-300" />
                        Active
                      </label>
                    </div>
                    <button type="submit" className="btn-outline !px-4 !py-2 !text-xs">Save</button>
                  </div>
                </form>
                <form action={deleteCategory} className="mt-2 border-t border-cocoa-50 pt-2 text-right">
                  <input type="hidden" name="id" value={cat.id} />
                  <button
                    type="submit"
                    className="text-xs font-semibold text-red-500 hover:text-red-700"
                    title="Deletes permanently (fails if products exist in this category)"
                  >
                    Delete category
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="card h-fit p-5" aria-labelledby="new-cat">
          <h2 id="new-cat" className="font-display text-lg font-bold text-cocoa-900">Add category</h2>
          <form action={saveCategory} className="mt-4 space-y-3">
            <div>
              <label htmlFor="new-cat-name" className="label">Name *</label>
              <input id="new-cat-name" name="name" type="text" required className="input" placeholder="e.g. Wedding Cakes" />
            </div>
            <div>
              <label htmlFor="new-cat-slug" className="label">Slug <span className="text-cocoa-400">(auto from name)</span></label>
              <input id="new-cat-slug" name="slug" type="text" className="input" placeholder="wedding-cakes" />
            </div>
            <div>
              <label htmlFor="new-cat-desc" className="label">Description</label>
              <input id="new-cat-desc" name="description" type="text" className="input" />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label htmlFor="new-cat-order" className="label">Sort order</label>
                <input id="new-cat-order" name="sortOrder" type="number" defaultValue={99} className="input !w-24" />
              </div>
              <label className="mt-5 flex items-center gap-2 text-sm text-cocoa-700">
                <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 rounded border-cocoa-300" />
                Active
              </label>
            </div>
            <button type="submit" className="btn-primary">Add Category</button>
          </form>
        </section>
      </div>
    </div>
  );
}
