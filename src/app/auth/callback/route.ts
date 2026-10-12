import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";
import { syncUserProfile } from "@/lib/profile-sync";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Keep public.profiles in sync with the Google identity (name, avatar).
      await syncUserProfile(data.user);

      // Guard against open redirects: only allow safe same-origin paths.
      return NextResponse.redirect(`${origin}${safeRedirectPath(next)}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
