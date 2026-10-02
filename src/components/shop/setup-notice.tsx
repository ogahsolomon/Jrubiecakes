export function SetupNotice() {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <div className="text-4xl" aria-hidden="true">🔌</div>
      <h2 className="mt-4 font-display text-xl font-bold text-cocoa-900">Store setup required</h2>
      <p className="mt-2 text-sm leading-relaxed text-cocoa-600">
        The product catalogue is powered by Supabase. Add your project credentials to
        <code className="mx-1 rounded bg-cocoa-100 px-1.5 py-0.5 text-xs">.env.local</code>
        and run the SQL in
        <code className="mx-1 rounded bg-cocoa-100 px-1.5 py-0.5 text-xs">supabase/schema.sql</code>
        to bring the store online.
      </p>
      <p className="mt-3 text-xs text-cocoa-500">
        See README.md for the 5-minute setup guide.
      </p>
    </div>
  );
}
