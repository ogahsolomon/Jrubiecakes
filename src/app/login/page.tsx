"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  // Friendly message for auth failures coming back from the callback route,
  // Google, or the provider configuration itself.
  const authErrorMessage = (() => {
    const err = searchParams.get("error");
    if (!err) return null;
    switch (err) {
      case "auth_callback_failed":
        return "We couldn't complete your sign-in. Please try again.";
      case "forbidden":
        return "You don't have permission to view that page.";
      case "google_not_configured":
        return "Google sign-in isn't available right now. Please use email and password.";
      case "unsupported_provider":
        return "That sign-in method isn't supported. Please use email and password.";
      default:
        return "Sign-in failed. Please try again, or use email and password.";
      }
  })();

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "consent" },
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
    // On success the browser redirects to Google
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push(next);
        router.refresh();
      } else {
        setMessage("Check your email for a confirmation link to complete your sign up.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push(next);
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <div className="card mx-auto w-full max-w-md p-8">
      <h1 className="font-display text-2xl font-bold text-cocoa-900">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-cocoa-500">
        {mode === "signin"
          ? "Sign in to order faster and track your deliveries."
          : "Join Jrubiecakes for faster checkout and order tracking."}
      </p>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="btn-outline mt-6 w-full !bg-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
          <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
        </svg>
        {mode === "signin" ? "Continue with Google" : "Sign up with Google"}
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-cocoa-400">
        <span className="h-px flex-1 bg-cocoa-200" aria-hidden="true" />
        or
        <span className="h-px flex-1 bg-cocoa-200" aria-hidden="true" />
      </div>

      <form onSubmit={handleEmail} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="fullName" className="label">Full name</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={8}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "signup" && (
            <p className="mt-1 text-xs text-cocoa-400">At least 8 characters.</p>
          )}
        </div>

      {(error || authErrorMessage) && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? authErrorMessage}
        </p>
      )}
        {message && (
          <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setMessage(null);
        }}
        className="mt-5 w-full text-center text-xs text-cocoa-500 hover:text-cocoa-700"
      >
        {mode === "signin"
          ? "New to Jrubiecakes? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="container-page flex min-h-[60vh] items-center py-10">
      <Suspense fallback={<div className="skeleton mx-auto h-96 w-full max-w-md" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
