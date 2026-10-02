import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserMetadata } from "@supabase/auth-js";

/**
 * Keep the profiles row in sync with the authenticated user's identity data
 * (Google provides name, email and avatar via user metadata).
 *
 * Uses the service-role client because the `handle_new_user` trigger only
 * fires on insert to auth.users — later identity changes would otherwise
 * never reach `public.profiles`.
 *
 * Never throws: profile sync is best-effort and must not break a sign-in.
 */
export async function syncUserProfile(user: {
  id: string;
  email?: string | null;
  user_metadata?: UserMetadata;
}): Promise<void> {
  const meta = user.user_metadata ?? {};
  const fullName: string | null = meta.full_name ?? meta.name ?? null;
  const avatarUrl: string | null = meta.avatar_url ?? meta.picture ?? null;

  if (!fullName && !avatarUrl && !user.email) return;

  try {
    const admin = createAdminClient();
    // Only set name when we have one, so we never clobber a name the user
    // already has; email and avatar always refresh from the provider.
    const patch: { email: string; full_name?: string; avatar_url?: string } = {
      email: user.email ?? "",
    };
    if (fullName) patch.full_name = fullName;
    if (avatarUrl) patch.avatar_url = avatarUrl;

    const { error } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", user.id);

    if (error) {
      // Row may not exist yet (trigger race); insert it.
      const { error: insertError } = await admin
        .from("profiles")
        .insert({ id: user.id, ...patch });
      if (insertError) {
        console.error("[profile-sync] failed:", insertError.message);
      }
    }
  } catch (err) {
    console.error("[profile-sync] unexpected error:", err);
  }
}
