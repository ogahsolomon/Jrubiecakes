'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setMessage('Password updated successfully');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='card mx-auto w-full max-w-md p-8'>
      <h1 className='font-display text-2xl font-bold text-cocoa-900'>Reset Password</h1>
      <p className='mt-1 text-sm text-cocoa-500'>Enter your new password.</p>
      <form onSubmit={handleSubmit} className='mt-6 space-y-4'>
        <div>
          <label htmlFor='password' className='label'>New Password</label>
          <input id='password' type='password' required minLength={8} className='input' value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role='alert' className='rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700'>{error}</p>}
        {message && <p role='status' className='rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700'>{message}</p>}
        <button type='submit' disabled={busy} className='btn-primary w-full'>{busy ? 'Updating...' : 'Update Password'}</button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className='container-page flex min-h-[60vh] items-center py-10'>
      <Suspense fallback={<div className='skeleton mx-auto h-48 w-full max-w-md' />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
