import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { ProductDetail } from "@/components/product/product-detail";
import { ProductCard } from "@/components/shop/product-card";
import { SITE } from "@/lib/constants";
import { effectivePrice } from "@/lib/money";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  const image = product.product_images?.[0]?.url;
  return {
    title: product.name,
    description:
      product.description?.slice(0, 160) ??
      `Order ${product.name} from ${SITE.name} — freshly baked and delivered across Nigeria.`,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.description?.slice(0, 160) ?? undefined,
      type: "website",
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const related = await getRelatedProducts(product, 4);
  const price = effectivePrice(product.price, product.sale_price);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.product_images?.map((i) => i.url),
    category: product.categories?.name,
    brand: { "@type": "Brand", name: SITE.name },
    offers: {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: price.toFixed(2),
      availability: product.is_available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${SITE.url}/product/${product.slug}`,
      seller: { "@type": "Organization", name: SITE.name },
    },
  };

  return (
    <div className="container-page py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Breadcrumb" className="text-xs text-cocoa-500">
        <Link href="/" className="hover:text-cocoa-700">Home</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/shop" className="hover:text-cocoa-700">Shop</Link>
        {product.categories && (
          <>
            <span aria-hidden="true"> / </span>
            <Link href={`/shop?category=${product.categories.slug}`} className="hover:text-cocoa-700">
              {product.categories.name}
            </Link>
          </>
        )}
        <span aria-hidden="true"> / </span>
        <span className="text-cocoa-800">{product.name}</span>
      </nav>

      <div className="mt-6">
        <ProductDetail product={product} />
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-xl font-bold text-cocoa-900">You may also like</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
