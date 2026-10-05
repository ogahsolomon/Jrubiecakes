import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl" aria-hidden="true">🍪</div>
      <h1 className="mt-6 font-display text-4xl font-bold text-cocoa-900">Crumb! Page not found</h1>
      <p className="mt-3 max-w-sm text-sm text-cocoa-500">
        The page you&apos;re looking for has been eaten. Let&apos;s get you back to something delicious.
      </p>
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link href="/" className="btn-primary">Go Home</Link>
        <Link href="/shop" className="btn-outline">Browse the Shop</Link>
      </div>
    </div>
  );
}
