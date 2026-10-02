"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { expireStalePaymentsAction } from "@/lib/admin-actions";
import { useToast } from "@/components/providers";

/**
 * Admin action button: abandons Paystack payments left pending/processing
 * for more than 24 hours. Shows how many payments were closed.
 */
export function ExpireStalePaymentsButton() {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const showToast = useToast();
  const router = useRouter();

  function run() {
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await expireStalePaymentsAction();
        if (result.expired === 0) {
          showToast("No stale payments to expire");
        } else {
          showToast(
            `Marked ${result.expired} payment${result.expired === 1 ? "" : "s"} as abandoned`
          );
        }
        router.refresh();
      } catch {
        showToast("Could not expire payments — try again", "error");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy || pending}
      className="btn-outline !py-2 !text-xs"
      title="Marks Paystack payments still pending after 24 hours as abandoned"
    >
      {busy || pending ? "Expiring…" : "Expire stale payments"}
    </button>
  );
}
