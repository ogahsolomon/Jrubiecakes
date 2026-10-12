import { NextResponse } from 'next/server';
import { SITE } from './constants';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  // The production website is always allowed. Native mobile clients generally
  // send no Origin header and do not need CORS headers.
  if (origin === SITE.url) return true;

  try {
    const url = new URL(origin);
    // Local development only. Never allow arbitrary public origins alongside
    // credentials: that would let another website make authenticated requests.
    return url.protocol === 'http:' && LOCAL_HOSTNAMES.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * CORS for native mobile clients. Web clients never need this because they
 * call the app same-origin with cookies.
 */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');

  if (!isAllowedOrigin(origin)) {
    return { Vary: 'Origin' };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function jsonWithCors(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(request) });
}

export function preflight(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}