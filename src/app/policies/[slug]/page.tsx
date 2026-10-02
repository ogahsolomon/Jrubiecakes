import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SITE } from "@/lib/constants";

type Params = Promise<{ slug: string }>;

const POLICIES: Record<string, { title: string; sections: { heading: string; body: string[] }[] }> = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "What we collect",
        body: [
          "When you place an order or create an account we collect your name, email address, phone number and delivery address. This is used only to fulfil your order and keep you updated.",
          "If you pay via Paystack, your payment is processed by Paystack on their secure platform. We never see or store your card details.",
        ],
      },
      {
        heading: "How we use your information",
        body: [
          "We use your contact details to confirm orders, send status updates and receipts, and contact you about your delivery or pickup.",
          "We do not sell or share your personal information with third parties except the payment processor (Paystack) and email provider (Mailgun) strictly to deliver our services to you.",
        ],
      },
      {
        heading: "Data retention & your rights",
        body: [
          "We keep order records for accounting and legal purposes. You may request a copy of your data or ask us to delete your account at any time by contacting us.",
          `Questions about privacy? Email ${SITE.email} or call ${SITE.phone}.`,
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    sections: [
      {
        heading: "Orders",
        body: [
          "All orders are subject to our confirmation. Custom cakes require a minimum of 48 hours' notice; larger celebration cakes may need up to 72 hours.",
          "Prices are shown in Nigerian Naira (₦) and include applicable taxes. Delivery fees are calculated at checkout based on your location.",
        ],
      },
      {
        heading: "Payment",
        body: [
          "We accept Paystack (card, bank transfer, USSD), direct bank transfer and cash on delivery/pickup (where enabled). Orders paid by bank transfer are confirmed after payment is verified.",
          "For Paystack orders, payment status is verified directly with Paystack before your order is confirmed as paid.",
        ],
      },
      {
        heading: "Products",
        body: [
          "Our cakes and pastries are made in a kitchen that handles eggs, milk, wheat, nuts and other allergens. Please tell us about allergies before ordering.",
          "Product images are representative. Custom cakes may vary slightly in decoration — that's the joy of handmade!",
        ],
      },
    ],
  },
  refunds: {
    title: "Refund & Cancellation Policy",
    sections: [
      {
        heading: "Cancellations",
        body: [
          "You may cancel a standard (non-custom) order up to 24 hours before the requested date for a full refund.",
          "Custom cakes are made to your specification and require ingredients purchased in advance. Cancellations within 48 hours of the requested date are refunded at 50%; within 24 hours, no refund.",
        ],
      },
      {
        heading: "Refunds",
        body: [
          "Approved refunds are processed within 5–7 business days. Paystack payments are refunded to the original payment method; bank transfer refunds are made to the paying account.",
          "If your order arrives damaged or incorrect, contact us within 24 hours with a photo and we'll arrange a replacement or refund.",
        ],
      },
    ],
  },
  delivery: {
    title: "Delivery Information",
    sections: [
      {
        heading: "Delivery areas & fees",
        body: [
          "We deliver across Abuja and can arrange nationwide delivery for larger orders. Delivery fees are shown at checkout based on your state.",
          "For pickup, we'll send you our bakery address and opening hours after order confirmation.",
        ],
      },
      {
        heading: "Timing",
        body: [
          "Standard orders: 24–48 hours' notice. Custom cakes: at least 48 hours. You'll choose your requested date at checkout and we'll confirm availability.",
          "Our delivery partner will call you on arrival. Please ensure someone is available to receive the cake — cakes are perishable!",
        ],
      },
    ],
  },
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const policy = POLICIES[slug];
  return { title: policy?.title ?? "Policies" };
}

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export default async function PolicyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();

  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="font-display text-4xl font-bold text-cocoa-900">{policy.title}</h1>
      <div className="mt-8 space-y-8">
        {policy.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-lg font-bold text-cocoa-900">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed text-cocoa-600">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-10 text-xs text-cocoa-400">Last updated: October 2026</p>
    </div>
  );
}
