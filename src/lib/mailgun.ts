import "server-only";

const MAILGUN_API = "https://api.mailgun.net";

function mailgunConfig() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM_EMAIL ?? "Jrubiecakes <orders@jrubiecakes.com>";
  if (!apiKey || !domain) {
    return null;
  }
  return { apiKey, domain, from };
}

export type MailAttachment = { filename: string; data: Buffer };

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const config = mailgunConfig();
  if (!config) {
    console.warn("[mailgun] MAILGUN_API_KEY/MAILGUN_DOMAIN not set; skipping email:", params.subject);
    return { ok: false, error: "Email not configured" };
  }

  const body = new URLSearchParams();
  const toList = Array.isArray(params.to) ? params.to : [params.to];
  for (const t of toList) body.append("to", t);
  body.set("from", config.from);
  body.set("subject", params.subject);
  body.set("html", params.html);
  if (params.text) body.set("text", params.text);
  if (params.cc) for (const c of params.cc) body.append("cc", c);

  try {
    const res = await fetch(`${MAILGUN_API}/v3/${config.domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[mailgun] send failed:", res.status, text.slice(0, 300));
      return { ok: false, error: `Mailgun ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[mailgun] network error:", err);
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
