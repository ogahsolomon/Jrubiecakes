import Link from "next/link";
import { SITE } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-cocoa-100 bg-cream-100">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="font-display text-lg font-bold text-cocoa-900">
            Jrubie<span className="text-blush-500">cakes</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-cocoa-600">
            Beautiful cakes &amp; delicious treats made with love for your special moments.
          </p>
          <div className="mt-4 flex gap-3">
            {Object.entries(SITE.social).map(([name, url]) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                className="rounded-full bg-cocoa-100 p-2 text-cocoa-700 hover:bg-cocoa-200"
              >
                <span className="text-xs font-semibold capitalize">{name.slice(0, 2)}</span>
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-cocoa-800">Contact</h3>
          <ul className="mt-3 space-y-2 text-sm text-cocoa-600">
            <li>📞 {SITE.phone}</li>
            <li>✉️ {SITE.email}</li>
            <li>📍 {SITE.address}</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-cocoa-800">Business hours</h3>
          <ul className="mt-3 space-y-2 text-sm text-cocoa-600">
            {SITE.hours.map((h) => (
              <li key={h.days}>
                {h.days}
                <br />
                <span className="text-cocoa-500">{h.time}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-cocoa-500">
            Delivery across Abuja &amp; nationwide on request. Order 48 hours ahead for custom cakes.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-cocoa-800">Information</h3>
          <ul className="mt-3 space-y-2 text-sm text-cocoa-600">
            <li><Link className="hover:text-cocoa-900" href="/policies/privacy">Privacy Policy</Link></li>
            <li><Link className="hover:text-cocoa-900" href="/policies/terms">Terms of Service</Link></li>
            <li><Link className="hover:text-cocoa-900" href="/policies/refunds">Refund &amp; Cancellation Policy</Link></li>
            <li><Link className="hover:text-cocoa-900" href="/policies/delivery">Delivery Information</Link></li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-cocoa-500">
            <span className="badge bg-cocoa-100 text-cocoa-700">Paystack</span>
            <span className="badge bg-cocoa-100 text-cocoa-700">Bank Transfer</span>
            <span className="badge bg-cocoa-100 text-cocoa-700">Cards</span>
            <span className="badge bg-cocoa-100 text-cocoa-700">USSD</span>
          </div>
        </div>
      </div>

      <div className="border-t border-cocoa-100 py-4 text-center text-xs text-cocoa-500">
        © {new Date().getFullYear()} Jrubiecakes. All rights reserved.
      </div>
    </footer>
  );
}
