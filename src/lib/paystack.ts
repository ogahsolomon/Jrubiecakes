import "server-only";

const PAYSTACK_BASE = "https://api.paystack.co";
const PAYSTACK_CHECKOUT_HOSTS = new Set(["checkout.paystack.com", "paystack.com", "www.paystack.com"]);

function assertCheckoutUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Paystack returned an invalid checkout URL");
  }
  if (parsed.protocol !== "https:" || !PAYSTACK_CHECKOUT_HOSTS.has(parsed.hostname)) {
    throw new Error("Paystack returned an unexpected checkout URL");
  }
  return parsed.toString();
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

export type InitTransactionResult =
  | { ok: true; authorizationUrl: string; accessCode: string; reference: string }
  | { ok: false; error: string };

/** Initialize a Paystack transaction (server-side only). */
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<InitTransactionResult> {
  try {
    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: params.email,
        amount: params.amountKobo,
        currency: "NGN",
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
      }),
      cache: "no-store",
    });

    const json = await res.json();
    if (!res.ok || !json?.status || !json?.data?.authorization_url) {
      return { ok: false, error: json?.message ?? "Paystack initialization failed" };
    }

    return {
      ok: true,
      authorizationUrl: assertCheckoutUrl(json.data.authorization_url),
      accessCode: json.data.access_code,
      reference: json.data.reference,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export type VerifyTransactionResult =
  | {
      ok: true;
      status: "success" | "failed" | "abandoned" | "pending" | "reversed";
      amountKobo: number;
      reference: string;
      paidAt: string | null;
      raw: unknown;
    }
  | { ok: false; error: string };

/** Verify a transaction with Paystack (server-side only). */
export async function verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
  try {
    const res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey()}` },
        cache: "no-store",
      }
    );

    const json = await res.json();
    if (!res.ok || !json?.status || !json?.data) {
      return { ok: false, error: json?.message ?? "Paystack verification failed" };
    }

    return {
      ok: true,
      status: json.data.status,
      amountKobo: json.data.amount,
      reference: json.data.reference,
      paidAt: json.data.paid_at ?? null,
      raw: json.data,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * Verify webhook signature using HMAC SHA512 of the raw body with the
 * secret key (Paystack's documented scheme).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): Promise<boolean> {
  if (!signature) return false;
  const { createHmac, timingSafeEqual } = await import("crypto");
  const hash = createHmac("sha512", secretKey()).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(hash, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
