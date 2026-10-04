'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setMessage('Password reset link sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='card mx-auto w-full max-w-md p-8'>
      <h1 className='font-display text-2xl font-bold text-cocoa-900'>Forgot Password</h1>
      <p className='mt-1 text-sm text-cocoa-500'>Enter your email to receive a reset link.</p>
      <form onSubmit={handleSubmit} className='mt-6 space-y-4'>
        <div>
          <label htmlFor='email' className='label'>Email</label>
          <input id='email' type='email' autoComplete='email' required className='input' value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <p role='alert' className='rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700'>{error}</p>}
        {message && <p role='status' className='rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700'>{message}</p>}
        <button type='submit' disabled={busy} className='btn-primary w-full'>{busy ? 'Sending...' : 'Send Reset Link'}</button>
      </form>
      <Link href='/login' className='mt-4 block text-center text-xs text-cocoa-500 hover:text-cocoa-700'>Back to login</Link>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className='container-page flex min-h-[60vh] items-center py-10'>
      <Suspense fallback={<div className='skeleton mx-auto h-48 w-full max-w-md' />}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
