import { NextResponse } from 'next/server';

/**
 * CORS for native mobile clients. Web clients never need this because they
 * call the app same-origin with cookies.
 */
export function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? '*';

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