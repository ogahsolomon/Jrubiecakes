import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("cart_state")
    .upsert({ user_id: user.id, items: [] as any }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: "Could not clear cart" }, { status: 500 });
  return NextResponse.json({ items: [] });
}
