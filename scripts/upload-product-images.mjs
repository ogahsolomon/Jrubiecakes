/**
 * Uploads the local product photos in public/products to the Supabase
 * `product-images` storage bucket and rewrites product_images.url rows
 * from local /products/... paths to the public storage URLs.
 *
 * Usage:
 *   1. Set env vars in .env.local (SUPABASE_SERVICE_ROLE_KEY etc.)
 *   2. Run:  npm run seed:images
 */
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Load .env.local so `npm run seed:images` works without exporting vars
// manually (Node >= 20.6). If the file is absent, env must come from the shell.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local — rely on shell env */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const BUCKET = "product-images";

// local file -> product slug mapping (matches supabase/schema.sql seed)
const SLUG_MAP = {
  "birthday-cake.png": "custom-birthday-cake",
  "childrens-cake.png": "childrens-themed-cake",
  "number-cake.png": "number-cake",
  "cupcakes.png": "decorated-cupcakes-box-6",
  "gift-cake.png": "gift-cake",
  "wedding-cake.png": "classic-white-celebration-cake",
  "cake-loaf.png": "cake-loaf",
  "uniced-cake.png": "uniced-cake",
  "donuts.png": "donuts-box-6",
  "meat-pies.png": "meat-pie",
  "fish-pies.png": "fish-pie",
  "chin-chin.png": "chin-chin-jar",
  "cookies.png": "cookies-pack-8",
  "small-chops.png": "small-chops-platter",
  "sausage-rolls.png": "sausage-rolls-pack-6",
};

const dir = join(process.cwd(), "public", "products");
const files = readdirSync(dir).filter((f) => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".webp"));

for (const file of files) {
  const slug = SLUG_MAP[file];
  if (!slug) {
    console.log(`- skipping ${file} (no product mapping)`);
    continue;
  }

  const path = `seed/${file}`;
  const body = readFileSync(join(dir, file));

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: "image/png", upsert: true });

  if (upErr && !upErr.message.includes("already")) {
    console.error(`! upload failed for ${file}:`, upErr.message);
    continue;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  // find product id by slug
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("id")
    .eq("slug", slug)
    .single();

  if (pErr || !product) {
    console.error(`! product not found for slug ${slug}`);
    continue;
  }

  // update existing local-path image rows
  const { error: uErr } = await supabase
    .from("product_images")
    .update({ url: publicUrl })
    .eq("product_id", product.id)
    .like("url", "/products/%");

  console.log(uErr ? `! db update failed for ${slug}: ${uErr.message}` : `✓ ${slug} -> ${publicUrl}`);
}

console.log("done");
