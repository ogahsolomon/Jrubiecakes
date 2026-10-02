import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category, Product, ProductOption } from "@/types";

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR-PROJECT");

type ProductQueryOptions = {
  categorySlug?: string;
  search?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc";
  featuredOnly?: boolean;
  limit?: number;
  page?: number;
  pageSize?: number;
};

const PRODUCT_SELECT = `
  *,
  categories (id, name, slug),
  product_images (id, url, alt_text, sort_order)
`;

function sortImages(products: Product[]): Product[] {
  return products.map((p) => ({
    ...p,
    product_images: [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getProducts(opts: ProductQueryOptions = {}): Promise<{
  products: Product[];
  total: number;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { products: [], total: 0, error: "not_configured" };
  }

  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, opts.pageSize ?? 12));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    .eq("is_available", true);

  if (opts.featuredOnly) query = query.eq("is_featured", true);

  if (opts.categorySlug) {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", opts.categorySlug)
      .single();
    if (!category) return { products: [], total: 0, error: null };
    query = query.eq("category_id", category.id);
  }

  if (opts.search) {
    // Strip characters that would break the PostgREST filter grammar
    const safe = opts.search.replace(/[,%()]/g, " ").trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  switch (opts.sort) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "name_asc":
      query = query.order("name", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("[catalog] getProducts error:", error.message);
    return { products: [], total: 0, error: error.message };
  }

  return { products: sortImages((data ?? []) as Product[]), total: count ?? 0, error: null };
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const { products } = await getProducts({ featuredOnly: true, limit, pageSize: limit });
  return products;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `${PRODUCT_SELECT},
       product_options (
         id, product_id, name, type, is_required, sort_order,
         product_option_values (id, option_id, value, price_delta, sort_order)
       )`
    )
    .eq("slug", slug)
    .eq("is_available", true)
    .single();

  if (error || !data) return null;

  const product = data as Product;
  product.product_images = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  product.product_options = [...(product.product_options ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((opt: ProductOption) => ({
      ...opt,
      product_option_values: [...(opt.product_option_values ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    }));

  return product;
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_available", true)
    .eq("category_id", product.category_id)
    .neq("id", product.id)
    .limit(limit);

  return sortImages((data ?? []) as Product[]);
}

export async function getCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[catalog] getCategories error:", error.message);
    return [];
  }
  return (data ?? []) as Category[];
}

export async function getSiteSetting<T>(key: string, fallback: T): Promise<T> {
  if (!isSupabaseConfigured) return fallback;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("site_settings").select("value").eq("key", key).single();
    return (data?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getDeliveryZones() {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_settings")
    .select("*")
    .eq("is_active", true)
    .order("zone_name");
  return data ?? [];
}

export async function getApprovedTestimonials(limit = 6) {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, customer_name, rating, comment, created_at")
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export type BankDetails = { bankName: string; accountNumber: string; accountName: string };
export type PaymentOptions = { paystack: boolean; bank_transfer: boolean; cash: boolean };
