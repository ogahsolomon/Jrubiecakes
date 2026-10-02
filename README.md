# Jrubiecakes 🎂

Production-ready bakery e-commerce for **Jrubiecakes** — birthday cakes, children's cakes,
cupcakes and Nigerian pastries, built for the Nigerian market (NGN pricing, Nigerian
checkout, Paystack payments).

## Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Backend    | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Payments   | Paystack (online), bank transfer, cash on delivery |
| Email      | Brevo (transactional templates)      |
| Testing    | Vitest (unit), `tsc --noEmit` (typecheck) |

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

**Note:** the site renders with friendly "setup required" notices until Supabase is
configured. All real order/payment logic is server-side — no fake backends.

## Setup (15 minutes)

### 1. Supabase (database, auth, storage)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it.
   This creates every table, RLS policy, storage bucket, trigger, and seeds:
   - 14 categories, 15 products (from the real catalogue photos), per-product
     customization options (cake size, flavour, frosting, message, theme…)
   - Default site settings + delivery zones
3. Copy from **Settings → API** into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)
4. **Auth → URL Configuration**: set Site URL to `http://localhost:3000` (and your
   production domain later).
5. **Auth → Providers → Google**: enable and paste your Google OAuth client
   (next step). Also add email/password if you want it (enabled by default).
6. Optional: upload the local product photos to Storage and point image rows at them:
   ```bash
   npm run seed:images
   ```

### 2. Google OAuth

Full walkthrough: **[docs/google-oauth-setup.md](docs/google-oauth-setup.md)**.

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project.
2. **APIs & Services → OAuth consent screen** → External → add your app name and support email.
3. **Credentials → Create credentials → OAuth client ID** → Web application.
4. Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   (find the exact value in Supabase **Auth → Providers → Google**).
5. Paste the client ID/secret into Supabase's Google provider settings.

### 3. Paystack

Full walkthrough: **[docs/paystack-setup.md](docs/paystack-setup.md)**.

1. Create an account at [paystack.com](https://paystack.com); grab keys from
   **Settings → API Keys & Webhooks** (test keys first).
2. Put into `.env.local`:
   - `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_…`
   - `PAYSTACK_SECRET_KEY=sk_test_…`
3. Webhook URL: `https://your-domain.com/api/webhooks/paystack` — wait, the actual
   route is **`/api/payments/paystack/webhook`**. Add that URL in the dashboard.
   Copy the webhook secret into `PAYSTACK_WEBHOOK_SECRET`.

> Security: transactions are initialized and verified **server-side only**. The
> webhook validates the HMAC-SHA512 signature of the raw body. An order is marked
> paid **only** after server-side verification or a valid webhook event. Amounts
> are matched exactly against the order total. Processing is idempotent.

### 4. Brevo

1. Create an account at [brevo.com](https://brevo.com) and complete sender
   verification (Brevo emails you a confirmation link).
2. Put into `.env.local`:
   - `BREVO_API_KEY` — from **SMTP & API → API Keys → Generate a new API key**
   - `BREVO_FROM_EMAIL` — a **verified sender** from **SMTP & API → Senders &
     Domains** (either `orders@yourdomain.com` or the
     `something@smtp-relay.brevo.com` address Brevo gives you on signup)
   - `BREVO_FROM_NAME` — optional display name
   - `ADMIN_EMAIL` (receives new-order + contact notifications)
3. Emails included: order confirmation (customer), new order (admin), payment
   confirmation, order status updates. If Brevo isn't configured the app still
   works — emails are skipped with a console warning.

> Migrating from Mailgun? `BREVO_FROM_EMAIL` accepts the same
> `"Name <address>"` format, so your old `MAILGUN_FROM_EMAIL` value can be
> pasted straight in. Brevo has no per-domain URL segment, so `MAILGUN_DOMAIN`
> has no equivalent — the sender address is verified inside Brevo instead.
> Note Brevo's free tier caps at 300 emails/day.

### 5. Admin access

Your Supabase project needs to know who is an admin:

- Easiest: sign up through the site (Google or email), then in Supabase
  **Table Editor → profiles**, set your row's `role` to `admin`.
- Or pre-configure: run in SQL Editor
  (`app.admin_bootstrap_emails` is checked when a new user signs up):
  ```sql
  alter database postgres set "app.admin_bootstrap_emails" = 'you@example.com';
  ```
  New sign-ups with that email become admin automatically.
- Then visit `/admin` (signed in).

## Scripts

| Command             | Purpose                              |
|---------------------|--------------------------------------|
| `npm run dev`       | Dev server                           |
| `npm run build`     | Production build                     |
| `npm run start`     | Serve production build               |
| `npm run typecheck` | TypeScript check                     |
| `npm run lint`      | ESLint (next/core-web-vitals)        |
| `npm test`          | Vitest unit tests (money, slug, validation, cart) |
| `npm run seed:images` | Upload `public/products` photos to Supabase Storage |

## Architecture

```
src/
  app/
    page.tsx                 Home (hero, categories, featured, custom cake CTA, pastries, testimonials)
    shop/                    Catalogue: filters, search, sort, pagination
    product/[slug]/          Detail page: gallery, options picker, JSON-LD, related
    cart/                    Full cart page
    checkout/                4-step checkout + Paystack callback + success
    login/ account/ orders/  Auth, profile, order history & tracking
    admin/                   Protected dashboard: metrics, orders, products
                             (+ options & image upload), categories, customers,
                             payments, settings (bank details, contact, delivery)
    api/
      orders/                POST create order (server-side total recalculation)
      payments/paystack/     initialize (via orders route), verify, webhook
      settings/              public store settings endpoints
      contact/               contact form → Brevo
    sitemap.ts robots.ts     SEO
  components/                UI + feature components (cart drawer, product card…)
  lib/
    supabase/                client (browser), server (RSC), admin (service role), middleware
    pricing.ts               Server-side cart pricing engine (never trusts client prices)
    paystack.ts              Init/verify/webhook signature helpers
    email.ts                Reusable mail service (Brevo) + templates
    catalog.ts               Data access + graceful setup-required states
  types/                     Hand-written Database types (with Relationships)
supabase/schema.sql          Full schema: tables, indexes, RLS, storage, triggers, seed
scripts/                     Image processing + storage seeding
public/products/             Real product photos extracted from the master doc
```

### Security model

- **RLS everywhere**: customers see only their own orders; catalogue is
  world-readable; only `profiles.role = 'admin'` (via `is_admin()`) can write
  products/categories/settings.
- **Server-authoritative totals**: the checkout API recalculates every price,
  option delta, delivery fee and total from the database. The client only sends
  product IDs, quantities and option selections.
- **Payments**: Paystack is initialized server-side; success is decided only by
  server verification or a signature-verified webhook; amount mismatches are
  rejected; duplicate webhook deliveries are ignored (idempotent).
- **Secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`,
  `BREVO_API_KEY`) exist only in server env vars, never shipped to the browser.

### Where integration credentials are required

Everything runs without credentials up to a point: browsing the seeded catalogue
requires Supabase; orders require Supabase; card payments require Paystack;
emails require Brevo. The app shows a friendly setup notice instead of crashing
when Supabase isn't configured yet.
