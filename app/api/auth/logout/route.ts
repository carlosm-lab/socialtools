import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, clearEntitlementsCookie, clearOAuthCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  const response = NextResponse.json(
    {
      success: true,
      message: 'Sesión cerrada correctamente',
    },
    { status: 200 }
  );

  clearSessionCookie(response);
  clearEntitlementsCookie(response);
  clearOAuthCookies(response);

  return response;
}

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get('return_to') || '/';
  const safeReturnTo = (returnTo.startsWith('/') && !returnTo.startsWith('//')) ? returnTo : '/';

  const destination = new URL(safeReturnTo, request.url);
  destination.searchParams.set('logged_out', '1');

  const response = NextResponse.redirect(destination);

  clearSessionCookie(response);
  clearEntitlementsCookie(response);
  clearOAuthCookies(response);

  return response;
}
