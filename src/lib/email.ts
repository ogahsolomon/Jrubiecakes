import "server-only";
import { SITE } from "./constants";

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

/** Brevo rejects display names longer than 70 characters. */
const NAME_MAX = 70;

function truncateName(name: string): string {
  return name.length > NAME_MAX ? name.slice(0, NAME_MAX) : name;
}

/**
 * Accepts either a bare address or the combined "Name <email>" form, so the
 * old MAILGUN_FROM_EMAIL value can be copied across unchanged.
 */
export function parseFromAddress(input: string): { name: string | null; email: string } {
  const combined = input.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  if (combined) {
    const name = combined[1].replace(/^["']|["']$/g, "").trim();
    return { name: name ? truncateName(name) : null, email: combined[2].trim() };
  }
  return { name: null, email: input.trim() };
}

function brevoConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const fromRaw = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !fromRaw) {
    return null;
  }

  const parsed = parseFromAddress(fromRaw);
  if (!parsed.email) {
    return null;
  }

  const explicitName = process.env.BREVO_FROM_NAME?.trim();
  const senderName = explicitName || parsed.name || SITE.name;

  const replyToRaw = process.env.BREVO_REPLY_TO?.trim();

  return {
    apiKey,
    sender: { name: truncateName(senderName), email: parsed.email },
    replyTo: replyToRaw ? parseFromAddress(replyToRaw).email : undefined,
  };
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const config = brevoConfig();
  if (!config) {
    console.warn("[brevo] BREVO_API_KEY/BREVO_FROM_EMAIL not set; skipping email:", params.subject);
    return { ok: false, error: "Email not configured" };
  }

  const toList = (Array.isArray(params.to) ? params.to : [params.to])
    .map((address) => address.trim())
    .filter(Boolean);
  if (toList.length === 0) {
    return { ok: false, error: "No recipient" };
  }

  const replyTo = params.replyTo ?? config.replyTo;

  const body = {
    sender: config.sender,
    to: toList.map((email) => ({ email })),
    subject: params.subject,
    htmlContent: params.html,
    ...(params.text ? { textContent: params.text } : {}),
    ...(params.cc?.length
      ? { cc: params.cc.map((email) => ({ email: email.trim() })).filter((c) => c.email) }
      : {}),
    ...(replyTo ? { replyTo: { email: replyTo } } : {}),
  };

  try {
    const res = await fetch(BREVO_API, {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    // Brevo answers 201 on success; res.ok covers the whole 2xx range.
    if (!res.ok) {
      const text = await res.text();
      console.error("[brevo] send failed:", res.status, text.slice(0, 300));
      return { ok: false, error: `Brevo ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[brevo] network error:", err);
    return { ok: false, error: "Network error" };
  }
}

/** Escape user content for safe interpolation into HTML emails. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}