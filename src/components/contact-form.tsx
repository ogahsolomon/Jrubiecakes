"use client";

import { useState } from "react";
import { useToast } from "@/components/providers";

export function ContactForm() {
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          message: String(data.get("message") ?? ""),
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Could not send your message. Please try again.");
        setBusy(false);
        return;
      }

      setSent(true);
      showToast("Message sent! We'll reply soon.");
      form.reset();
    } catch {
      setError("Network error — please try again.");
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="card flex h-fit flex-col items-center p-10 text-center">
        <div className="text-4xl" aria-hidden="true">💌</div>
        <h2 className="mt-4 font-display text-xl font-bold text-cocoa-900">Message sent!</h2>
        <p className="mt-2 text-sm text-cocoa-600">
          Thank you for reaching out — we usually reply within a few hours during business hours.
        </p>
        <button type="button" onClick={() => setSent(false)} className="btn-outline mt-6">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card h-fit space-y-4 p-6" aria-label="Contact form">
      <h2 className="font-display text-lg font-bold text-cocoa-900">Send us a message</h2>

      <div>
        <label htmlFor="ct-name" className="label">Your name</label>
        <input id="ct-name" name="name" type="text" required minLength={2} className="input" autoComplete="name" />
      </div>
      <div>
        <label htmlFor="ct-email" className="label">Email</label>
        <input id="ct-email" name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label htmlFor="ct-message" className="label">Message</label>
        <textarea
          id="ct-message"
          name="message"
          rows={5}
          required
          minLength={10}
          className="input"
          placeholder="Tell us about your event, the date, and what you have in mind…"
        />
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
