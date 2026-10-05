import Link from "next/link";
import { getCategories, getFeaturedProducts, getApprovedTestimonials, getSiteSetting } from "@/lib/catalog";
import { ProductCard } from "@/components/shop/product-card";
import { ResilientImage } from "@/components/ui/resilient-image";
import { SITE } from "@/lib/constants";

type AboutStory = { heading: string; story: string };

const DEFAULT_STORY: AboutStory = {
  heading: "Our story",
  story:
    "Jrubiecakes began in a home kitchen in Abuja with one oven, a whisk and a simple belief: a cake should taste as joyful as the moment it celebrates. Today we bake custom birthday and children's cakes, cupcakes and Nigerian pastries for families across the capital — still small-batch, still made to order, still with real butter.",
};

export const revalidate = 300;

const FEATURED_CATEGORY_SLUGS = [
  "birthday-cakes",
  "childrens-cakes",
  "cupcakes",
  "pastries",
  "small-chops",
  "cookies",
];

const CATEGORY_IMAGES: Record<string, string> = {
  "birthday-cakes": "/products/birthday-cake.png",
  "childrens-cakes": "/products/childrens-cake.png",
  cupcakes: "/products/cupcakes.png",
  pastries: "/products/donuts.png",
  "small-chops": "/products/small-chops.png",
  cookies: "/products/cookies.png",
  // Fallback for any featured category without its own photo.
  fallback: "/products/pasteries.png",
};

const PASTRIES = [
  { name: "Donuts", slug: "donuts", image: "/products/donuts.png" },
  { name: "Chin Chin", slug: "chin-chin", image: "/products/chin-chin.png" },
  { name: "Cookies", slug: "cookies", image: "/products/cookies.png" },
  { name: "Small Chops", slug: "small-chops", image: "/products/small-chops.png" },
  { name: "Sausage Rolls", slug: "sausage-rolls", image: "/products/sausage-rolls.png" },
  { name: "Fish Pies", slug: "fish-pies", image: "/products/fish-pies.png" },
  { name: "Meat Pies", slug: "meat-pies", image: "/products/meat-pies.png" },
];

const WHY_US = [
  { icon: "🌿", title: "Freshly Made", text: "Every order is baked fresh — never pre-packaged, never frozen." },
  { icon: "🎨", title: "Custom Designs", text: "Tell us your theme and we'll design a cake that's uniquely yours." },
  { icon: "🥚", title: "Quality Ingredients", text: "Real butter, premium cocoa and fresh eggs in every bite." },
  { icon: "🎉", title: "Great for Celebrations", text: "Birthdays, weddings, baby showers — we bake for every milestone." },
  { icon: "📱", title: "Convenient Ordering", text: "Order from your phone in minutes. Pay online or on delivery." },
];

const FALLBACK_TESTIMONIALS = [
  { id: "1", customer_name: "Adaeze O.", rating: 5, comment: "The princess cake for my daughter's 5th birthday was absolutely stunning. Everyone asked where we got it!" },
  { id: "2", customer_name: "Tunde A.", rating: 5, comment: "Ordered small chops for our office party. Fresh, hot and the pepper sauce was perfect. Will order again." },
  { id: "3", customer_name: "Chiamaka N.", rating: 5, comment: "Jrubiecakes made our wedding cake exactly as I imagined. Delivery was on time and the cake tasted amazing." },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden="true" className={i < rating ? "text-amber-500" : "text-cocoa-200"}>★</span>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const [categories, featured, testimonials, story] = await Promise.all([
    getCategories(),
    getFeaturedProducts(8),
    getApprovedTestimonials(6),
    getSiteSetting<AboutStory>("about_story", DEFAULT_STORY),
  ]);

  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const featuredCategories = FEATURED_CATEGORY_SLUGS.map((slug) => {
    const found = categoryBySlug.get(slug);
    if (found) return found;
    // "Pastries" is a storefront grouping, not a DB category — synthesize it
    if (slug === "pastries") {
      return { id: "pastries", slug: "pastries", name: "Pastries", description: null, image_url: null, sort_order: 0, is_active: true, created_at: "", updated_at: "" };
    }
    return null;
  }).filter(Boolean);

  const shownTestimonials = testimonials.length > 0 ? testimonials : FALLBACK_TESTIMONIALS;

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-cream-100">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div>            <span className="badge bg-blush-100 text-blush-700">Baked fresh in Nigeria 🇳🇬</span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-cocoa-900 sm:text-5xl">
              Made for Your Sweetest Moments
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-cocoa-600">
              Beautiful birthday cakes, celebration cakes, cupcakes and freshly made pastries.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop?category=birthday-cakes" className="btn-primary">
                Shop Cakes
              </Link>
              <Link href="/shop?category=donuts" className="btn-outline">
                Shop Pastries
              </Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[
                ["500+", "Happy customers"],
                ["48hrs", "Custom cake lead time"],
                ["100%", "Fresh ingredients"],
              ].map(([stat, label]) => (
                <div key={label}>
                  <dt className="font-display text-2xl font-bold text-cocoa-900">{stat}</dt>
                  <dd className="text-xs text-cocoa-500">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-3 lg:max-w-none">
            <div className="relative col-span-2 aspect-[4/3] overflow-hidden rounded-3xl shadow-card sm:aspect-[16/10]">
              <ResilientImage
                src="/products/birthday-cake.png"
                alt="Jrubiecakes custom birthday cake with pink buttercream"
                fill
                priority
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-3xl shadow-card">
              <ResilientImage src="/products/cupcakes.png" alt="Decorated cupcakes box" fill className="object-cover object-top" sizes="25vw" fallbackEmoji="🧁" />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-3xl shadow-card">
              <ResilientImage src="/products/small-chops.png" alt="Small chops platter" fill className="object-cover" sizes="25vw" fallbackEmoji="🥟" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Featured categories ---------- */}
      <section className="container-page py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-cocoa-900 sm:text-3xl">Shop by category</h2>
            <p className="mt-1 text-sm text-cocoa-500">From celebration cakes to party chops</p>
          </div>
<Link href="/shop" className="shrink-0 text-sm font-semibold text-blush-600 hover:text-blush-700">
              View all →
            </Link>
          </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {featuredCategories.map((cat) => (
            <Link
              key={cat!.id}
              href={`/shop?category=${cat!.slug}`}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl shadow-card"
            >
              <ResilientImage
                src={CATEGORY_IMAGES[cat!.slug] ?? CATEGORY_IMAGES.fallback}
                alt={cat!.name}
                fill
                className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                fallbackEmoji="🧁"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-cocoa-900/70 via-cocoa-900/10 to-transparent" />
              <span className="absolute bottom-2 left-2 right-2 text-xs font-semibold leading-tight text-white drop-shadow-sm sm:bottom-3 sm:left-3 sm:right-3 sm:text-sm">
                {cat!.name}
              </span>
            </Link>
          ))}
          {featuredCategories.length === 0 && (
            <p className="col-span-full text-sm text-cocoa-500">
              Categories will appear here once the store is connected.
            </p>
          )}
        </div>
      </section>

      {/* ---------- Featured products ---------- */}
      <section className="bg-cream-100 py-14">
        <div className="container-page">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-cocoa-900 sm:text-3xl">Customer favourites</h2>
              <p className="mt-1 text-sm text-cocoa-500">The treats our customers can&apos;t stop ordering</p>
            </div>
            <Link href="/shop" className="hidden text-sm font-semibold text-blush-600 hover:text-blush-700 sm:block">
              Shop all →
            </Link>
          </div>

          {featured.length > 0 ? (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl bg-white p-6 text-sm text-cocoa-500 shadow-card">
              Featured products will appear here once the store is connected to Supabase.
            </p>
          )}
        </div>
      </section>

      {/* ---------- Custom cake CTA ---------- */}
      <section className="container-page py-14">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-cocoa-800 lg:grid-cols-2">
          <div className="p-8 lg:p-12">
            <span className="badge bg-blush-500/20 text-blush-200">Made for you</span>
            <h2 className="mt-3 font-display text-3xl font-bold text-cream-50">
              Custom cakes, made for your celebration
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-cream-200/90">
              Planning a birthday or a children&apos;s party? Request a cake designed around
              your celebration — pick the size, flavour, filling and frosting, tell us the
              theme and colours, and add your message on top. Reference photos are welcome;
              we bake exactly what you imagine.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-cream-100/90">
              {["Birthday & children&apos;s themes", "Your choice of flavour & filling", "Personalised message & colours", "Ready in as little as 48 hours"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-blush-300">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/product/childrens-themed-cake" className="btn-blush mt-7">
              Request a Custom Cake
            </Link>
          </div>
          <div className="relative min-h-64 lg:min-h-96 lg:h-full">
            <ResilientImage
              src="/products/childrens-cake.png"
              alt="Children's themed birthday cake"
              fill
              className="object-cover object-top"
              sizes="(max-width: 1024px) 100vw, 50vw"
              fallbackEmoji="🎈"
            />
          </div>
        </div>
      </section>

      {/* ---------- Pastries ---------- */}
      <section className="container-page py-14">
        <div>
          <h2 className="font-display text-2xl font-bold text-cocoa-900 sm:text-3xl">Pastries &amp; party treats</h2>
          <p className="mt-1 text-sm text-cocoa-500">Perfect for parties, offices and gifting</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
          {PASTRIES.map((p) => (
            <Link
              key={p.slug}
              href={`/shop?category=${p.slug}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="relative aspect-square overflow-hidden bg-cocoa-100">
                <ResilientImage
                  src={p.image}
                  alt={p.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 14vw"
                  fallbackEmoji="🍩"
                />
              </div>
              <div className="p-3 text-center">
                <span className="text-xs font-semibold text-cocoa-800">{p.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- About JruBiecakes (admin-editable) ---------- */}
      <section className="container-page py-14">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-card">
            <ResilientImage
              src="/products/cake-loaf.png"
              alt="Freshly baked treats from the Jrubiecakes kitchen"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div>
            <span className="badge bg-cream-200 text-cocoa-600">About Jrubiecakes</span>
            <h2 className="mt-3 font-display text-3xl font-bold text-cocoa-900">
              {story.heading || DEFAULT_STORY.heading}
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-cocoa-600">
              {story.story || DEFAULT_STORY.story}
            </p>
            <dl className="mt-6 grid max-w-md grid-cols-3 gap-4">
              {[
                ["500+", "Happy customers"],
                ["48hrs", "Custom lead time"],
                ["100%", "Fresh ingredients"],
              ].map(([stat, label]) => (
                <div key={label}>
                  <dt className="font-display text-2xl font-bold text-cocoa-900">{stat}</dt>
                  <dd className="text-xs text-cocoa-500">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {WHY_US.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-6 text-center shadow-card transition-shadow hover:shadow-card-hover">
              <div className="text-3xl" aria-hidden="true">{item.icon}</div>
              <h3 className="mt-3 text-sm font-bold text-cocoa-900">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-cocoa-500">{item.text}</p>
            </div>
          ))}
      </div>
      </section>

      {/* ---------- Testimonials ---------- */}
      <section className="container-page py-14">
        <h2 className="text-center font-display text-2xl font-bold text-cocoa-900 sm:text-3xl">
          What our customers say
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {shownTestimonials.slice(0, 3).map((t) => (
            <figure key={t.id} className="rounded-2xl bg-white p-6 shadow-card">
              <Stars rating={t.rating} />
              <blockquote className="mt-3 text-sm leading-relaxed text-cocoa-700">
                &ldquo;{t.comment}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-xs font-semibold text-cocoa-500">
                — {t.customer_name}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="container-page pb-4">
        <div className="rounded-3xl bg-cocoa-800 px-6 py-12 text-center">
          <h2 className="font-display text-2xl font-bold text-cream-50 sm:text-3xl">
            Planning a birthday or celebration?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-cream-200/90">
            Let JruBiecakes make it special.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/product/fully-custom-cake" className="btn-blush">Order a Custom Cake</Link>
            <Link href="/contact" className="btn-ghost !text-cream-100 hover:!bg-cocoa-700">Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
