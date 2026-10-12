import { describe, expect, it } from "vitest";
import { corsHeaders } from "../cors";
import { SITE } from "../constants";

function requestWithOrigin(origin: string | null): Request {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return new Request("https://api.example.test/api/cart", { headers });
}

describe("corsHeaders", () => {
  it("allows the configured site origin", () => {
    const headers = corsHeaders(requestWithOrigin(SITE.url));
    expect(headers["Access-Control-Allow-Origin"]).toBe(SITE.url);
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("does not reflect arbitrary origins", () => {
    const headers = corsHeaders(requestWithOrigin("https://evil.example"));
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
    expect(headers.Vary).toBe("Origin");
  });

  it("does not add CORS headers when there is no origin", () => {
    const headers = corsHeaders(requestWithOrigin(null));
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
