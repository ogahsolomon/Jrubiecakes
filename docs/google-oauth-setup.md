# Google OAuth sign-in — setup guide

This app uses **Supabase Auth** as the broker for Google sign-in. Your Google
client ID and secret live **only** in the Supabase dashboard — they are never
placed in this codebase or in `.env` files.

How it works at a glance:

```
Browser → Supabase (/auth/v1/authorize?provider=google) → Google consent screen
        → callback to Supabase → redirect to {SITE_URL}/auth/callback
        → app exchanges code for session (PKCE) → profile synced → /account
```

## 1. Create the Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Top-left project dropdown → **New Project**.
3. Name it (e.g. `jrubiecakes`), click **Create**, then select it.

## 2. Configure the OAuth consent screen

1. Menu → **APIs & Services → OAuth consent screen**.
2. User type: **External** → **Create**.
3. Fill in:
   - App name: `Jrubiecakes`
   - User support email: your email
   - Developer contact email: your email
4. Click **Save and Continue** through Scopes (defaults are fine — Supabase
   only needs `email`, `profile`, `openid`).
5. You can leave **Test users** empty while testing; add real users before
   publishing, or set publishing status to **In production** when live.

## 3. Create OAuth credentials

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: `jrubiecakes-web`.
4. **Authorized redirect URIs** — add **both**:

   | Purpose | URI |
   |---|---|
   | Supabase receives Google's response | `https://YOUR-PROJECT.supabase.co/auth/v1/callback` |
   | Local development (optional but handy) | `http://localhost:3000/auth/callback` |

   Replace `YOUR-PROJECT` with your actual Supabase project ref (found in
   Supabase → Settings → General). The Supabase callback URI is the one that
   **must** be present — without it Google shows `redirect_uri_mismatch`.

5. Click **Create**. A dialog shows the **Client ID** and **Client secret** —
   copy both. (You can retrieve them later from the credentials list.)

## 4. Configure the Google provider in Supabase

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → your project.
2. **Authentication → Providers → Google**.
3. Toggle **Enable**.
4. Paste the **Client ID** and **Client secret** from step 3.
5. **Save**.

6. While you're here, check **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` for development (your production
     domain when you deploy).
   - **Redirect URLs** should include `http://localhost:3000/auth/callback`
     (and later `https://yourdomain.com/auth/callback`).

## 5. Environment variables required

Nothing Google-specific goes into `.env.local` — the credentials live in
Supabase. The variables the auth flow relies on:

| Variable | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server clients | From Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server clients | From Supabase → Settings → API |
| `NEXT_PUBLIC_SITE_URL` | Builds the OAuth redirect target | Must match the URL Configuration above |

## 6. Test it

1. `npm run dev` and open `http://localhost:3001/login`.
2. Click **Continue with Google** → complete the consent screen.
3. You should land on `/account` with your Google name and avatar shown.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` at Google | The Supabase callback URI isn't registered | Add `https://YOUR-PROJECT.supabase.co/auth/v1/callback` to Authorized redirect URIs (step 3.4) |
| `Error 403: access_denied` | App is in Testing mode and your Google account isn't a test user | Add your account under Test users, or publish the app |
| Redirect lands on login with "couldn't complete sign-in" | Redirect URL missing in Supabase URL Configuration | Add `{SITE_URL}/auth/callback` under Redirect URLs (step 4.6) |
| Name/avatar missing on `/account` | `avatar_url` column doesn't exist yet | Re-run `supabase/schema.sql` (it's safe to re-run) |

## How the pieces fit in this codebase

- `src/app/login/page.tsx` — Google button, calls `signInWithOAuth({ provider: "google" })`
- `src/app/auth/callback/route.ts` — exchanges the PKCE code for a session, then syncs the profile
- `src/lib/profile-sync.ts` — writes name/email/avatar into `public.profiles`
- `src/lib/supabase/middleware.ts` — protects `/account`, `/checkout`, `/admin` (role-checked)
- `src/app/auth/signout/route.ts` — POST sign-out
- `public.profiles.avatar_url` — added by `supabase/schema.sql`
