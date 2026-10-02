import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/catalog";

export async function GET(request: NextRequest) {
  const state = new URL(request.url).searchParams.get("state") ?? "";
  if (!state || !isSupabaseConfigured) {
    return NextResponse.json({ fee: null });
  }

  const supabase = await createClient();
  const { data: zones } = await supabase
    .from("delivery_settings")
    .select("zone_name, states, fee")
    .eq("is_active", true);

  const matching = (zones ?? []).find((z) => (z.states ?? []).includes(state));
  const fallback = (zones ?? []).find((z) => z.zone_name === "Default");

  const zone = matching ?? fallback;
  return NextResponse.json({ fee: zone?.fee ?? null });
}
