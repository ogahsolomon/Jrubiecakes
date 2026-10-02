import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/catalog";
import { SITE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/policies/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/policies/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/policies/refunds`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/policies/delivery`, changeFrequency: "yearly", priority: 0.4 },
  ];

  if (!isSupabaseConfigured) return staticRoutes;

  const admin = createAdminClient();

  const [products, categories] = await Promise.all([
    admin.from("products").select("slug, updated_at").eq("is_available", true).limit(1000),
    admin.from("categories").select("slug").eq("is_active", true).limit(100),
  ]);

  return [
    ...staticRoutes,
    ...(categories.data ?? []).map((c) => ({
      url: `${SITE.url}/shop?category=${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...(products.data ?? []).map((p) => ({
      url: `${SITE.url}/product/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
