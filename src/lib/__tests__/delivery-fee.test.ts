import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("@/lib/catalog", () => ({
  isSupabaseConfigured: true,
}));

import { GET } from "../../app/api/settings/delivery-fee/route";
import { formatNGN } from "../money";

type Zone = { zone_name: string; states: string[] | null; fee: number };

function mockZones(zones: Zone[]) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(async () => ({ data: zones })),
  };
  fromMock.mockReturnValue(builder);
}

function request(query = "") {
  return new NextRequest(`http://localhost:3000/api/settings/delivery-fee${query}`);
}

async function feeFor(query: string) {
  const res = await GET(request(query));
  return (await res.json()).fee;
}

beforeEach(() => {
  fromMock.mockReset();
});

describe("GET /api/settings/delivery-fee", () => {
  it("returns the fee in kobo, matching the unit the checkout total uses", async () => {
    mockZones([{ zone_name: "Default", states: [], fee: 5000 }]);
    const fee = await feeFor("?state=Lagos");
    // 5000 naira must be 500000 kobo. Returning the raw 5000 renders as
    // "N50.00" next to a kobo cart subtotal -- a 100x under-quote.
    expect(fee).toBe(500000);
    expect(formatNGN(fee)).toContain("5,000");
  });

  it("agrees with the fee the server-side pricing engine charges", async () => {
    mockZones([{ zone_name: "Default", states: [], fee: 5000 }]);
    // pricing.ts: Math.round(zone.fee) * 100
    const fee = await feeFor("?state=Lagos");
    expect(fee).toBe(Math.round(5000) * 100);
  });

  it("prefers a zone that lists the requested state", async () => {
    mockZones([
      { zone_name: "Default", states: [], fee: 5000 },
      { zone_name: "Lagos", states: ["Lagos"], fee: 2500 },
    ]);
    expect(await feeFor("?state=Lagos")).toBe(250000);
  });

  it("falls back to the Default zone when no zone lists the state", async () => {
    mockZones([
      { zone_name: "Default", states: [], fee: 5000 },
      { zone_name: "Lagos", states: ["Lagos"], fee: 2500 },
    ]);
    expect(await feeFor("?state=Kano")).toBe(500000);
  });

  it("rounds fractional naira fees to whole kobo", async () => {
    mockZones([{ zone_name: "Default", states: [], fee: 1234.56 }]);
    expect(await feeFor("?state=Lagos")).toBe(123456);
  });

  it("returns a null fee when no zones are configured", async () => {
    mockZones([]);
    expect(await feeFor("?state=Lagos")).toBeNull();
  });

  it("returns a null fee and skips the database when no state is given", async () => {
    expect(await feeFor("")).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });
});