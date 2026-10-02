# Paystack payments — setup guide

Jrubiecakes supports three payment methods: **Paystack** (card/transfer/USSD),
**bank transfer** (manual confirmation) and **cash on delivery/pickup**.

All Paystack communication happens **server-side**. The secret key never
reaches the browser; the customer's browser only receives the hosted
checkout URL that Paystack generates.

## How a payment flows

```
Checkout → POST /api/orders (server recalculates total from DB prices,
           creates order + payment row with a unique reference)
         → Paystack initialize (server) → hosted checkout URL
         → customer pays → redirect to /checkout/callback?reference=…
         → GET /api/payments/paystack/verify (server verifies with Paystack,
           amount-checked, idempotent) → order marked paid
         → (independent) Paystack webhook → same idempotent update path
```

The order is marked **paid only after server-side verification or a
signature-verified webhook**. Amounts are matched exactly against the order
total; mismatches are rejected for manual review. Duplicate webhook
deliveries and duplicate verification calls are ignored (idempotent).

## 1. Create a Paystack account

1. Sign up at [paystack.com](https://paystack.com).
2. Complete business verification when you're ready to go live (test mode
   works immediately).

## 2. Get your keys

Dashboard → **Settings → API Keys & Webhooks**:

| Key | Env var | Where it lives |
|---|---|---|
| **Secret key** (`sk_test_…` / `sk_live_…`) | `PAYSTACK_SECRET_KEY` | Server only — never in client code |
| **Public key** (`pk_test_…` / `pk_live_…`) | `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Safe for the browser (display only) |

## 3. Environment variables

Add to `.env.local` (see `.env.example`):

```bash
# Public: safe in the browser
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxx

# SECRET: server-only. Never expose.
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx

# Webhook signing secret — Paystack shows it under Settings → API Keys & Webhooks
PAYSTACK_WEBHOOK_SECRET=whsec_xxxxxxxx

# Base URL used to build the payment callback (defaults to the site URL)
PAYSTACK_CALLBACK_URL_BASE=http://localhost:3000
```

There are also the usual Supabase vars (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`) which the order flow
needs.

## 4. Configure the webhook

1. Paystack dashboard → **Settings → API Keys & Webhooks**.
2. In **Webhook URL**, enter:

   ```
   https://your-domain.com/api/payments/paystack/webhook
   ```

   For local development, use a tunnel (e.g. `ngrok http 3000`) and use the
   tunnel URL + `/api/payments/paystack/webhook`.
3. Copy the **Webhook signing secret** shown there into
   `PAYSTACK_WEBHOOK_SECRET`.
4. Paystack only calls webhooks over HTTPS with a valid certificate.

> The webhook validates the HMAC-SHA512 signature of the **raw body** using
> your secret key. Requests with an invalid signature are rejected with 401.

## 5. Payment statuses

| Status | Meaning | Set by |
|---|---|---|
| `pending` | Order created, payment not attempted/completed | Checkout |
| `processing` | Payment in flight at Paystack (their `pending`) | Verify endpoint |
| `awaiting_payment` | Bank transfer — waiting for the customer to pay | Checkout |
| `paid` | Verified server-side (verify endpoint or webhook) | Verify / webhook |
| `failed` | Paystack reported failure, or amount mismatch | Verify / webhook |
| `abandoned` | Customer closed/cancelled the Paystack checkout | Verify endpoint |
| `refunded` | Admin marked the payment refunded | Admin dashboard |

## 6. Bank transfer & cash

- **Bank transfer**: the checkout shows the bank name, account number and
  account name configured in **Admin → Settings → Bank details**. The
  customer receives an order number and pays; the order sits at
  *awaiting payment* until an admin opens **Admin → Payments** and sets it
  to **Paid** (or **Failed**).
- **Cash**: the order is created as *pending* and an admin marks it **Paid**
  after the customer has paid on delivery/pickup.

Both are confirmed in **Admin → Payments** using the per-row status dropdown.

## 7. Error handling

| Scenario | Behaviour |
|---|---|
| Payment initialization fails | Order is kept with a `failed` payment row; customer sees an error and can retry |
| Customer cancels / closes Paystack | Verify reports `abandoned`; order stays unpaid; customer not charged |
| Payment fails at Paystack | Verify marks payment `failed`; order payment status becomes `failed` |
| Expired / stale payment | Verify returns `processing`; webhook or a later verify call will settle it |
| Duplicate webhook / verify calls | Idempotency checks skip already-processed payments |
| Amount mismatch (tampering or partial payment) | Rejected; flagged in server logs for manual review; never marked paid |
| Invalid/unknown reference in webhook | Acknowledged with a note; no state is changed |
| Webhook retries | Safe — Paystack retries non-2xx responses; all handlers are idempotent |

## 8. Test it

Use Paystack test cards on the hosted checkout, e.g.:

- `4084 0840 8408 4081` + any future expiry/CVV, OTP `123456` → success
- `5060 6606 6066 6066 690` → insufficient funds / declined

After paying you should land on `/checkout/callback`, the order becomes
**Paid** in **Admin → Orders/Payments**, and the webhook delivery appears
under Paystack dashboard → **Paystack Inspect**.
