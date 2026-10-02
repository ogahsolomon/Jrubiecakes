"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl" aria-hidden="true">chef's kiss</div>
      <h1 className="mt-6 font-display text-3xl font-bold text-cocoa-900">Something went wrong</h1>
      <p className="mt-3 max-w-sm text-sm text-cocoa-500">
        We burned this batch. Please try again — the oven is still hot.
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-8">
        Try Again
      </button>
    </div>
  );
}
