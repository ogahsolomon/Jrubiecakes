
import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/constants";
import { ResilientImage } from "@/components/ui/resilient-image";

export const metadata: Metadata = {
  title: "About Us",
  description: `The story behind ${SITE.name} — beautiful cakes and delicious treats made with love in Nigeria.`,
};

const VALUES = [
  { icon: "🧁", title: "Fresh every day", text: "We bake to order — nothing sits on a shelf." },
  { icon: "🥰", title: "Made with love", text: "Every cake leaves our kitchen like a gift to family." },
  { icon: "🌟", title: "Quality first", text: "Premium cocoa, real butter, fresh eggs. No shortcuts." },
  { icon: "🤝", title: "Community", text: "We're proud to serve celebrations across Nigeria." },
];

export default function AboutPage() {
  return (
    <div className="container-page max-w-4xl py-12">
      <h1 className="font-display text-4xl font-bold text-cocoa-900">Our Story</h1>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
        <div className="space-y-4 text-sm leading-relaxed text-cocoa-600">
          <p>
            Jrubiecakes started with a simple belief: every celebration deserves a cake as special
            as the people celebrating. What began as a home kitchen passion became a bakery
            trusted for birthdays, baby showers, weddings and every &quot;just because&quot; moment in between.
          </p>
          <p>
            From princess castles and superhero themes for the little ones, to elegant tiered cakes
            for milestone birthdays, and trays of small chops that disappear before the party
            really starts — everything is baked fresh for your order.
          </p>
          <p>
            We&apos;re proudly Nigerian, serving customers across the country with convenient online
            ordering, flexible payment options and delivery to your door.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/shop" className="btn-primary">Shop Our Treats</Link>
            <Link href="/contact" className="btn-outline">Get in Touch</Link>
          </div>
        </div>

        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-card">
<ResilientImage
            src="/products/birthday-cake.png"
            alt="A Jrubiecakes birthday cake"
            fill
            className="object-cover object-top"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
      </div>

      <section className="mt-14" aria-labelledby="values">
        <h2 id="values" className="font-display text-2xl font-bold text-cocoa-900">What we stand for</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} className="card flex gap-4 p-5">
              <span className="text-2xl" aria-hidden="true">{v.icon}</span>
              <div>
                <h3 className="text-sm font-bold text-cocoa-900">{v.title}</h3>
                <p className="mt-1 text-sm text-cocoa-500">{v.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
