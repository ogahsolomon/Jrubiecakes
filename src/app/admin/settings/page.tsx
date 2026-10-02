import { createAdminClient } from "@/lib/supabase/admin";
import {
  saveBankDetails,
  saveAboutStory,
  saveContactSettings,
  saveDeliverySettings,
  savePaymentOptions,
} from "@/lib/admin-actions";

type AboutStory = { heading: string; story: string };

export const dynamic = "force-dynamic";

type BankDetails = { bankName: string; accountNumber: string; accountName: string };
type Contact = { phone: string; whatsapp: string; email: string; address: string };
type Delivery = { defaultFee: number; pickupEnabled: boolean; leadTimeHours: number };
type PaymentOptions = { paystack: boolean; bank_transfer: boolean; cash: boolean };

export default async function AdminSettingsPage() {
  const admin = createAdminClient();
  const { data: settings } = await admin.from("site_settings").select("key, value");

  const get = <T,>(key: string, fallback: T): T => {
    const row = settings?.find((s) => s.key === key);
    return (row?.value as T) ?? fallback;
  };

  const bank = get<BankDetails>("bank_details", { bankName: "", accountNumber: "", accountName: "" });
  const about = get<AboutStory>("about_story", {
    heading: "Our story",
    story:
      "Jrubiecakes began in a home kitchen in Abuja with one oven, a whisk and a simple belief: a cake should taste as joyful as the moment it celebrates. Today we bake custom birthday and children's cakes, cupcakes and Nigerian pastries for families across the capital — still small-batch, still made to order, still with real butter.",
  });
  const contact = get<Contact>("contact", { phone: "", whatsapp: "", email: "", address: "" });
  const delivery = get<Delivery>("delivery", { defaultFee: 2000, pickupEnabled: true, leadTimeHours: 48 });
  const payments = get<PaymentOptions>("payment_options", { paystack: true, bank_transfer: true, cash: true });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-cocoa-900">Settings</h1>
        <p className="mt-1 text-sm text-cocoa-500">Store configuration — shown to customers at checkout</p>
      </div>

      {/* Bank details */}
      <section className="card p-6" aria-labelledby="bank">
        <h2 id="bank" className="font-display text-lg font-bold text-cocoa-900">🏦 Bank transfer details</h2>
        <p className="mt-1 text-xs text-cocoa-500">
          Shown to customers who choose bank transfer. Never hard-code these in code — they live here.
        </p>
        <form action={saveBankDetails} className="mt-4 space-y-4">
          <div>
            <label htmlFor="bankName" className="label">Bank name</label>
            <input id="bankName" name="bankName" type="text" defaultValue={bank.bankName} className="input" placeholder="e.g. GTBank" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="accountNumber" className="label">Account number</label>
              <input id="accountNumber" name="accountNumber" type="text" inputMode="numeric" defaultValue={bank.accountNumber} className="input" placeholder="0123456789" />
            </div>
            <div>
              <label htmlFor="accountName" className="label">Account name</label>
              <input id="accountName" name="accountName" type="text" defaultValue={bank.accountName} className="input" placeholder="Jrubiecakes Ltd" />
            </div>
          </div>
          <button type="submit" className="btn-primary">Save Bank Details</button>
        </form>
      </section>

      {/* About story (renders on the homepage) */}
      <section className="card p-6" aria-labelledby="about">
        <h2 id="about" className="font-display text-lg font-bold text-cocoa-900">📖 Bakery story</h2>
        <p className="mt-1 text-xs text-cocoa-500">
          Shown in the &ldquo;About Jrubiecakes&rdquo; section on the homepage.
        </p>
        <form action={saveAboutStory} className="mt-4 space-y-4">
          <div>
            <label htmlFor="aboutHeading" className="label">Heading</label>
            <input id="aboutHeading" name="heading" type="text" defaultValue={about.heading} className="input" maxLength={120} />
          </div>
          <div>
            <label htmlFor="aboutStory" className="label">Story</label>
            <textarea id="aboutStory" name="story" rows={5} defaultValue={about.story} className="input" maxLength={2000} />
          </div>
          <button type="submit" className="btn-primary">Save Story</button>
        </form>
      </section>

      {/* Contact */}
      <section className="card p-6" aria-labelledby="contact">
        <h2 id="contact" className="font-display text-lg font-bold text-cocoa-900">📞 Contact information</h2>
        <form action={saveContactSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="label">Phone</label>
            <input id="phone" name="phone" type="tel" defaultValue={contact.phone} className="input" />
          </div>
          <div>
            <label htmlFor="whatsapp" className="label">WhatsApp</label>
            <input id="whatsapp" name="whatsapp" type="tel" defaultValue={contact.whatsapp} className="input" />
          </div>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" name="email" type="email" defaultValue={contact.email} className="input" />
          </div>
          <div>
            <label htmlFor="address" className="label">Address</label>
            <input id="address" name="address" type="text" defaultValue={contact.address} className="input" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">Save Contact Info</button>
          </div>
        </form>
      </section>

      {/* Delivery */}
      <section className="card p-6" aria-labelledby="delivery">
        <h2 id="delivery" className="font-display text-lg font-bold text-cocoa-900">🛵 Delivery settings</h2>
        <form action={saveDeliverySettings} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="defaultFee" className="label">Default delivery fee (₦)</label>
              <input id="defaultFee" name="defaultFee" type="number" min={0} defaultValue={delivery.defaultFee} className="input" />
              <p className="mt-1 text-xs text-cocoa-400">Used for states without a specific zone fee.</p>
            </div>
            <div>
              <label htmlFor="leadTimeHours" className="label">Minimum lead time (hours)</label>
              <input id="leadTimeHours" name="leadTimeHours" type="number" min={0} defaultValue={delivery.leadTimeHours} className="input" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-cocoa-700">
            <input type="checkbox" name="pickupEnabled" defaultChecked={delivery.pickupEnabled} className="h-4 w-4 rounded border-cocoa-300" />
            Allow customers to choose pickup
          </label>
          <button type="submit" className="btn-primary">Save Delivery Settings</button>
        </form>
      </section>

      {/* Payment options */}
      <section className="card p-6" aria-labelledby="payments">
        <h2 id="payments" className="font-display text-lg font-bold text-cocoa-900">💳 Payment methods</h2>
        <p className="mt-1 text-xs text-cocoa-500">
          Enable or disable payment methods customers can choose at checkout.
        </p>
        <form action={savePaymentOptions} className="mt-4 space-y-3">
          <label className="flex items-center gap-3 text-sm text-cocoa-700">
            <input type="checkbox" name="paystack" defaultChecked={payments.paystack} className="h-4 w-4 rounded border-cocoa-300" />
            Paystack (cards, transfer, USSD) — verified automatically
          </label>
          <label className="flex items-center gap-3 text-sm text-cocoa-700">
            <input type="checkbox" name="bank_transfer" defaultChecked={payments.bank_transfer} className="h-4 w-4 rounded border-cocoa-300" />
            Bank transfer — confirm manually
          </label>
          <label className="flex items-center gap-3 text-sm text-cocoa-700">
            <input type="checkbox" name="cash" defaultChecked={payments.cash} className="h-4 w-4 rounded border-cocoa-300" />
            Cash on delivery/pickup
          </label>
          <button type="submit" className="btn-primary">Save Payment Methods</button>
        </form>
      </section>

      <p className="rounded-2xl bg-cream-100 p-4 text-xs leading-relaxed text-cocoa-500">
        🔐 Secrets like the Paystack secret key, Mailgun API key and Supabase service role key live in
        environment variables (<code>.env.local</code>), never in the database or code.
      </p>
    </div>
  );
}
