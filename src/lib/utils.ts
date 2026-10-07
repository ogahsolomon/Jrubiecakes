import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Human-friendly order number: JRC-XXXXXX */
export function generateOrderNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) code += chars[b % chars.length];
  return `JRC-${code}`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(d);
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Allow only safe same-origin login redirects. Absolute URLs,
 * protocol-relative URLs, backslashes, encoded separators, and controls are
 * rejected because they can send a newly authenticated user elsewhere.
 */
export function safeRedirectPath(raw: unknown, fallback = "/account"): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("\\")) return fallback;
  if (/^\/(%2f|%5c)/i.test(raw)) return fallback;

  try {
    const decoded = decodeURIComponent(raw);
    if (/[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback;
  } catch {
    return fallback;
  }

  return raw;
}
