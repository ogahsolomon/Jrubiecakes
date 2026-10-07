"use client";

import { useState } from "react";
import { useCart } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const { clearCart } = useCart();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      // Clear the device cart before cookies/session change, so a later
      // account cannot inherit these lines on a shared browser.
      clearCart();
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch("/auth/signout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <button type="button" onClick={handleSignOut} disabled={busy} className={className}>
      {busy ? "Signing out…" : "Sign Out"}
    </button>
  );
}
