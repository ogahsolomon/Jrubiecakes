import type { Metadata } from "next";
import { SITE } from "@/lib/constants";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Questions about your order or a custom cake? Reach ${SITE.name} by phone, WhatsApp, email or the contact form.`,
};

export default function ContactPage() {
  return (
    <div className="container-page max-w-5xl py-12">
      <h1 className="font-display text-4xl font-bold text-cocoa-900">Get in Touch</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-cocoa-600">
        Questions about an order, a custom cake idea, or catering for your event? We&apos;d love to
        hear from you.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <a href={`tel:${SITE.phone.replace(/\s/g, "")}`} className="card flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
            <span className="text-2xl" aria-hidden="true">📞</span>
            <span>
              <span className="block text-xs uppercase tracking-wide text-cocoa-400">Call us</span>
              <span className="block font-semibold text-cocoa-900">{SITE.phone}</span>
            </span>
          </a>
          <a href={`https://wa.me/${SITE.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
            <span className="text-2xl" aria-hidden="true">💬</span>
            <span>
              <span className="block text-xs uppercase tracking-wide text-cocoa-400">WhatsApp</span>
              <span className="block font-semibold text-cocoa-900">{SITE.whatsapp}</span>
            </span>
          </a>
          <a href={`mailto:${SITE.email}`} className="card flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
            <span className="text-2xl" aria-hidden="true">✉️</span>
            <span>
              <span className="block text-xs uppercase tracking-wide text-cocoa-400">Email</span>
              <span className="block font-semibold text-cocoa-900">{SITE.email}</span>
            </span>
          </a>
          <div className="card p-5">
            <span className="text-xs uppercase tracking-wide text-cocoa-400">Business hours</span>
            <ul className="mt-2 space-y-1 text-sm text-cocoa-700">
              {SITE.hours.map((h) => (
                <li key={h.days} className="flex justify-between gap-4">
                  <span>{h.days}</span>
                  <span className="font-medium">{h.time}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <span className="text-xs uppercase tracking-wide text-cocoa-400">Find us</span>
            <p className="mt-2 text-sm text-cocoa-700">{SITE.address}</p>
            <div className="mt-3 flex gap-2 text-xs text-cocoa-500">
              {Object.entries(SITE.social).map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="badge bg-cocoa-100 capitalize text-cocoa-700 hover:bg-cocoa-200">
                  {name}
                </a>
              ))}
            </div>
          </div>
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
