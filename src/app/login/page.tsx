      <button
        type='button'
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setError(null);
          setMessage(null);
        }}
        className='mt-5 w-full text-center text-xs text-cocoa-500 hover:text-cocoa-700'
      >
        {mode === 'signin' ? 'New to Jrubiecakes? Create an account' : 'Already have an account? Sign in'}
      </button>
      {mode === 'signin' && (
        <div className='mt-4 text-center'>
          <a href='/forgot-password' className='text-xs text-cocoa-600 hover:text-cocoa-800 underline'>
            Forgot your password?
          </a>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className='container-page flex min-h-[60vh] items-center py-10'>
      <Suspense fallback={<div className='skeleton mx-auto h-96 w-full max-w-md' />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
