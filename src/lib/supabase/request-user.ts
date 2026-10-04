import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createCookieClient } from '@/lib/supabase/server';

export type AuthedUser = { id: string; email: string | null };

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolves the caller from either a Supabase session cookie (web) or an
 * `Authorization: Bearer <access_token>` header (native mobile app).
 * Falls back to cookies when no header is present.
 *
 * The user id always comes from a verified Supabase session, never from the
 * request body, so mobile and web share one authorisation boundary.
 */
export async function getRequestUser(request: Request): Promise<AuthedUser | null> {
  const token = readBearerToken(request);

  if (token) {
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );

    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;

    return { id: data.user.id, email: data.user.email ?? null };
  }

  const supabase = await createCookieClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}