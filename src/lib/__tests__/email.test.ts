import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

import { parseFromAddress, sendEmail } from "../email";

const ENV_KEYS = [
  "BREVO_API_KEY",
  "BREVO_FROM_EMAIL",
  "BREVO_FROM_NAME",
  "BREVO_REPLY_TO",
] as const;

function setEnv(vars: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(vars)) {
    process.env[key] = value as string;
  }
}

function sentBody() {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(init.body as string);
}

function sentHeaders() {
  const [, init] = fetchMock.mock.calls[0];
  return init.headers as Record<string, string>;
}

function okResponse() {
  return {
    ok: true,
    status: 201,
    text: async () => JSON.stringify({ messageId: "<abc@brevo>" }),
  } as unknown as Response;
}

// Re-stub every test: unstubbing globally between tests would let later cases
// reach the real api.brevo.com instead of the mock.
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(okResponse());
  setEnv({
    BREVO_API_KEY: "xkeysib-test",
    BREVO_FROM_EMAIL: "orders@jrubiecakes.com",
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("parseFromAddress", () => {
  it("accepts a bare address", () => {
    expect(parseFromAddress("orders@jrubiecakes.com")).toEqual({
      name: null,
      email: "orders@jrubiecakes.com",
    });
  });

  it("accepts the combined Name <email> form used by the old MAILGUN_FROM_EMAIL", () => {
    expect(parseFromAddress("Jrubiecakes <orders@jrubiecakes.com>")).toEqual({
      name: "Jrubiecakes",
      email: "orders@jrubiecakes.com",
    });
  });

  it("strips quotes from a quoted display name", () => {
    expect(parseFromAddress('"Jrubiecakes Bakery" <orders@jrubiecakes.com>')).toEqual({
      name: "Jrubiecakes Bakery",
      email: "orders@jrubiecakes.com",
    });
  });

  it("truncates display names past Brevo's 70 character limit", () => {
    const { name } = parseFromAddress(`${"N".repeat(120)} <a@b.com>`);
    expect(name).toHaveLength(70);
  });
});

describe("sendEmail", () => {
  it("posts JSON to the Brevo v3 transactional endpoint", async () => {
    const res = await sendEmail({
      to: "customer@example.com",
      subject: "Order JRC-123456",
      html: "<p>Thanks!</p>",
    });

    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect(init.headers["api-key"]).toBe("xkeysib-test");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("maps fields to Brevo's names: htmlContent and textContent", async () => {
    await sendEmail({
      to: "customer@example.com",
      subject: "Hi",
      html: "<p>Body</p>",
      text: "Body",
    });

    const body = sentBody();
    expect(body.htmlContent).toBe("<p>Body</p>");
    expect(body.textContent).toBe("Body");
    // Mailgun-era field names must not leak through
    expect(body.html).toBeUndefined();
    expect(body.text).toBeUndefined();
  });

  it("sends recipients as an array of objects", async () => {
    await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
    expect(sentBody().to).toEqual([{ email: "a@example.com" }]);
  });

  it("accepts multiple recipients and cc", async () => {
    await sendEmail({
      to: ["a@example.com", "b@example.com"],
      cc: ["c@example.com"],
      subject: "Hi",
      html: "<p>x</p>",
    });

    const body = sentBody();
    expect(body.to).toEqual([{ email: "a@example.com" }, { email: "b@example.com" }]);
    expect(body.cc).toEqual([{ email: "c@example.com" }]);
  });

  it("omits textContent and cc when not supplied", async () => {
    await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
    const body = sentBody();
    expect("textContent" in body).toBe(false);
    expect("cc" in body).toBe(false);
  });

  it("defaults the sender display name to the site name", async () => {
    await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
    expect(sentBody().sender).toEqual({
      name: "Jrubiecakes",
      email: "orders@jrubiecakes.com",
    });
  });

  it("honours BREVO_FROM_NAME and the combined from form", async () => {
    setEnv({
      BREVO_API_KEY: "xkeysib-test",
      BREVO_FROM_EMAIL: "Brevo Relay <orders@jrubiecakes.com>",
      BREVO_FROM_NAME: "Jrubiecakes Orders",
    });
    await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
    expect(sentBody().sender).toEqual({
      name: "Jrubiecakes Orders",
      email: "orders@jrubiecakes.com",
    });
  });

  it("applies BREVO_REPLY_TO when the caller does not override it", async () => {
    setEnv({
      BREVO_API_KEY: "xkeysib-test",
      BREVO_FROM_EMAIL: "orders@jrubiecakes.com",
      BREVO_REPLY_TO: "help@jrubiecakes.com",
    });
    await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
    expect(sentBody().replyTo).toEqual({ email: "help@jrubiecakes.com" });
  });

  it("lets the caller override replyTo, as the contact form does", async () => {
    await sendEmail({
      to: "admin@jrubiecakes.com",
      subject: "New message",
      html: "<p>x</p>",
      replyTo: "customer@example.com",
    });
    expect(sentBody().replyTo).toEqual({ email: "customer@example.com" });
  });

  it("keeps a per-send replyTo even when BREVO_REPLY_TO is set globally", async () => {
    // Admin order/payment notifications pass the customer's address so the
    // admin can reply straight to them; a globally configured BREVO_REPLY_TO
    // must not win over that.
    setEnv({
      BREVO_API_KEY: "xkeysib-test",
      BREVO_FROM_EMAIL: "orders@jrubiecakes.com",
      BREVO_REPLY_TO: "help@jrubiecakes.com",
    });
    await sendEmail({
      to: "admin@jrubiecakes.com",
      subject: "New order JRC-1",
      html: "<p>x</p>",
      replyTo: "customer@example.com",
    });
    expect(sentBody().replyTo).toEqual({ email: "customer@example.com" });
  });

  it("skips without throwing when Brevo is not configured", async () => {
    setEnv({});
    const res = await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
    expect(res).toEqual({ ok: false, error: "Email not configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the Brevo status code on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"code":"unauthorized","message":"Key not found"}',
    } as unknown as Response);

    const res = await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
    expect(res).toEqual({ ok: false, error: "Brevo 401" });
  });

  it("reports a network error without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" });
    expect(res).toEqual({ ok: false, error: "Network error" });
  });

  it("rejects an empty recipient list without calling Brevo", async () => {
    const res = await sendEmail({ to: "   ", subject: "Hi", html: "<p>x</p>" });
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});