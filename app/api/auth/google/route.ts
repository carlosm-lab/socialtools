import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_RETURN_TO_COOKIE_NAME,
  getOAuthRedirectUri,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Configuración de Google OAuth incompleta: GOOGLE_CLIENT_ID no está configurado.' },
      { status: 500 }
    );
  }

  // 1. Generate cryptographically random CSRF state token
  const state = crypto.randomBytes(32).toString('hex');

  // 2. Validate return destination to prevent open redirect vulnerabilities
  const returnParam = request.nextUrl.searchParams.get('return_to') || '/';
  const safeReturnTo = (returnParam.startsWith('/') && !returnParam.startsWith('//'))
    ? returnParam
    : '/';

  // 3. Resolve redirect URI matching request origin
  const redirectUri = getOAuthRedirectUri(request);

  // 4. Construct Google OAuth 2.0 authorization URL
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'select_account');

  // 5. Build redirect response and attach short-lived security cookies
  const response = NextResponse.redirect(googleAuthUrl.toString());
  const isProduction = process.env.NODE_ENV === 'production';

  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 minutes
  });

  response.cookies.set({
    name: OAUTH_RETURN_TO_COOKIE_NAME,
    value: safeReturnTo,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}
