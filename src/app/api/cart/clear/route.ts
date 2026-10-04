import { type NextRequest } from "next/server";
import { getRequestUser } from "@/lib/supabase/request-user";
import { jsonWithCors, preflight } from "@/lib/cors";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return jsonWithCors(request, { error: "Not signed in" }, 401);

  const admin = createAdminClient();
  const { error } = await admin
    .from("cart_state")
    .upsert({ user_id: user.id, items: [] as any }, { onConflict: "user_id" });

  if (error) return jsonWithCors(request, { error: "Could not clear cart" }, 500);
  return jsonWithCors(request, { items: [] });
}