import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/catalog";
import { CustomCakeWizard } from "@/components/custom-cake/custom-cake-wizard";
import { SetupNotice } from "@/components/shop/setup-notice";

export const metadata: Metadata = { title: "Design Your Cake — JruBiecakes" };
export const dynamic = "force-dynamic";

export default async function CustomCakePage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="container-page py-14">
        <h1 className="font-display text-3xl font-bold text-cocoa-900">Design Your Cake</h1>
        <div className="mt-10"><SetupNotice /></div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      `*,
       product_options (
         id, product_id, name, type, is_required, sort_order, created_at,
         product_option_values (id, option_id, value, price_delta, sort_order, created_at)
       )`
    )
    .eq("slug", "fully-custom-cake")
    .eq("is_available", true)
    .single();

  if (!product) notFound();

  return <CustomCakeWizard product={product} />;
}
