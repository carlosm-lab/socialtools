import { NextRequest, NextResponse } from 'next/server';
import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_RETURN_TO_COOKIE_NAME,
  getOAuthRedirectUri,
  signSession,
  setSessionCookie,
  signEntitlements,
  setEntitlementsCookie,
  getEntitlementsFromRequest,
  clearOAuthCookies,
} from '@/lib/auth';
import {
  getUserByEmail,
  createUser,
  updateUser,
  logTransaction,
  isAdminEmail,
  ADMIN_UNLIMITED_CREDITS,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const errorParam = url.searchParams.get('error');

  // Handle Google user cancellation or consent denial
  if (errorParam) {
    console.error('[Google OAuth] Consent error:', errorParam);
    const returnUrl = new URL('/', request.url);
    returnUrl.searchParams.set('auth_error', errorParam);
    const res = NextResponse.redirect(returnUrl);
    clearOAuthCookies(res);
    return res;
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const cookieReturnTo = request.cookies.get(OAUTH_RETURN_TO_COOKIE_NAME)?.value;

  const safeReturnTo = (cookieReturnTo && cookieReturnTo.startsWith('/') && !cookieReturnTo.startsWith('//'))
    ? cookieReturnTo
    : '/';

  // 1. Verify CSRF State Token
  if (!code || !state || !cookieState || state !== cookieState) {
    console.error('[Google OAuth] State mismatch or missing code.');
    const returnUrl = new URL('/', request.url);
    returnUrl.searchParams.set('auth_error', 'invalid_state');
    const res = NextResponse.redirect(returnUrl);
    clearOAuthCookies(res);
    return res;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('[Google OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
    const returnUrl = new URL('/', request.url);
    returnUrl.searchParams.set('auth_error', 'server_misconfiguration');
    const res = NextResponse.redirect(returnUrl);
    clearOAuthCookies(res);
    return res;
  }

  const redirectUri = getOAuthRedirectUri(request);

  // 2. Exchange authorization code with Google Token Endpoint
  let tokenData: { access_token?: string; id_token?: string; error?: string; error_description?: string };
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[Google OAuth] Token exchange failure:', tokenData);
      const returnUrl = new URL('/', request.url);
      returnUrl.searchParams.set('auth_error', 'token_exchange_failed');
      const res = NextResponse.redirect(returnUrl);
      clearOAuthCookies(res);
      return res;
    }
  } catch (err) {
    console.error('[Google OAuth] Token exchange network error:', err);
    const returnUrl = new URL('/', request.url);
    returnUrl.searchParams.set('auth_error', 'network_error');
    const res = NextResponse.redirect(returnUrl);
    clearOAuthCookies(res);
    return res;
  }

  // 3. Retrieve User Profile from Google UserInfo
  let profile: { sub: string; email: string; name: string; picture?: string; email_verified?: boolean };
  try {
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoRes.ok) {
      console.error('[Google OAuth] UserInfo request failed');
      const returnUrl = new URL('/', request.url);
      returnUrl.searchParams.set('auth_error', 'userinfo_failed');
      const res = NextResponse.redirect(returnUrl);
      clearOAuthCookies(res);
      return res;
    }

    profile = await userInfoRes.json();
  } catch (err) {
    console.error('[Google OAuth] UserInfo network error:', err);
    const returnUrl = new URL('/', request.url);
    returnUrl.searchParams.set('auth_error', 'userinfo_network_error');
    const res = NextResponse.redirect(returnUrl);
    clearOAuthCookies(res);
    return res;
  }

  if (!profile.email) {
    console.error('[Google OAuth] UserInfo missing email');
    const returnUrl = new URL('/', request.url);
    returnUrl.searchParams.set('auth_error', 'missing_email');
    const res = NextResponse.redirect(returnUrl);
    clearOAuthCookies(res);
    return res;
  }

  const normalizedEmail = profile.email.toLowerCase().trim();
  const isAdmin = isAdminEmail(normalizedEmail);

  // 4. Persistence & Dual-Layer Entitlements Reconciliation
  const existingCookieLedger = getEntitlementsFromRequest(request);
  let user = await getUserByEmail(normalizedEmail);

  if (!user) {
    // Check if the user already has a valid signed cookie ledger (e.g. from prior serverless invocation)
    const ledgerMatches = existingCookieLedger && existingCookieLedger.email.toLowerCase() === normalizedEmail;

    const initialRole = isAdmin ? 'admin' : (ledgerMatches ? (existingCookieLedger.plan === 'unlimited' ? 'admin' : 'user') : 'user');
    const initialPlan = isAdmin ? 'unlimited' : (ledgerMatches ? existingCookieLedger.plan : 'free');
    const initialCredits = isAdmin
      ? ADMIN_UNLIMITED_CREDITS
      : ledgerMatches
      ? existingCookieLedger.credits
      : 1;

    user = await createUser({
      email: normalizedEmail,
      name: profile.name || normalizedEmail.split('@')[0],
      picture: profile.picture,
      googleId: profile.sub,
      role: initialRole,
      plan: initialPlan,
      credits: initialCredits,
    });

    if (!ledgerMatches) {
      // First-time signup welcome credit grant
      await logTransaction({
        userId: user.id,
        type: isAdmin ? 'admin_grant' : 'free_grant',
        amount: initialCredits,
        balanceAfter: initialCredits,
        description: isAdmin
          ? 'Cuenta de administrador ilimitada inicializada'
          : 'Crédito de bienvenida (Prueba gratuita de 1 video)',
      });
    }
  } else {
    // Returning user login: update profile and refresh timestamp
    const updates: Parameters<typeof updateUser>[1] = {
      lastLoginAt: new Date().toISOString(),
    };
    if (profile.name && profile.name !== user.name) updates.name = profile.name;
    if (profile.picture && profile.picture !== user.picture) updates.picture = profile.picture;

    // Enforce permanent unlimited privileges for admin account
    if (isAdmin) {
      if (user.role !== 'admin') updates.role = 'admin';
      if (user.plan !== 'unlimited') updates.plan = 'unlimited';
      if (user.credits < ADMIN_UNLIMITED_CREDITS) updates.credits = ADMIN_UNLIMITED_CREDITS;
    }

    user = await updateUser(user.id, updates);
  }

  // 5. Sign HMAC Session Token
  const sessionToken = signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    plan: user.plan,
  });

  // 6. Sign Dual-Layer Entitlements Cookie Ledger
  const entitlementsToken = signEntitlements({
    sub: user.googleId || user.id,
    email: user.email,
    credits: user.credits,
    trialGranted: true,
    plan: user.plan,
    processedTxIds: existingCookieLedger?.processedTxIds || [],
  });

  // 7. Set cookies and redirect to safe destination
  const destination = new URL(safeReturnTo, request.url);
  destination.searchParams.set('auth', 'success');
  const response = NextResponse.redirect(destination);

  setSessionCookie(response, sessionToken);
  setEntitlementsCookie(response, entitlementsToken);
  clearOAuthCookies(response);

  return response;
}
