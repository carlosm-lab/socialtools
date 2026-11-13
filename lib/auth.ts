import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import type { SessionUser, SessionPayload, EntitlementsCookiePayload } from '@/lib/types';

export const SESSION_COOKIE_NAME = 'st_session';
export const ENTITLEMENTS_COOKIE_NAME = 'st_entitlements';
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
export const OAUTH_STATE_COOKIE_NAME = 'st_oauth_state';
export const OAUTH_RETURN_TO_COOKIE_NAME = 'st_oauth_return';

/**
 * Retrieves the cryptographic secret for HMAC-SHA256 signing.
 * Throws in production if AUTH_SECRET is omitted.
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET environment variable is missing in production.');
    }
    return 'dev-socialtools-auth-secret-key-32b-deterministic-fallback';
  }
  return secret;
}

/**
 * Creates a signed session token: `${base64url(payload)}.${base64url(signature)}`
 */
export function signSession(
  user: SessionUser,
  expiresInSec: number = SESSION_MAX_AGE
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSec;

  const payload: SessionPayload = {
    ...user,
    iat,
    exp,
  };

  const secret = getAuthSecret();
  const dataB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');

  return `${dataB64}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed session token.
 * Uses timing-safe constant-time comparison to prevent timing attacks.
 */
export function verifySession(token: string | null | undefined): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [dataB64, signature] = parts;
  if (!dataB64 || !signature) return null;

  try {
    const secret = getAuthSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payloadJson = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload: SessionPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null; // Token expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Creates a signed entitlements cookie token for Vercel serverless cold start resilience.
 */
export function signEntitlements(
  entitlements: EntitlementsCookiePayload,
  expiresInSec: number = SESSION_MAX_AGE
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSec;

  const payload: EntitlementsCookiePayload = {
    ...entitlements,
    iat,
    exp,
  };

  const secret = getAuthSecret();
  const dataB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');

  return `${dataB64}.${signature}`;
}

/**
 * Verifies and decodes the HMAC-SHA256 signed st_entitlements cookie.
 */
export function verifyEntitlements(token: string | null | undefined): EntitlementsCookiePayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [dataB64, signature] = parts;
  if (!dataB64 || !signature) return null;

  try {
    const secret = getAuthSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payloadJson = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload: EntitlementsCookiePayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null; // Token expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Dynamically computes the OAuth redirect URI matching the incoming request host or NEXT_PUBLIC_APP_URL.
 */
export function getOAuthRedirectUri(request: NextRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');

  let baseUrl = '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    baseUrl = `${proto}://${host}`;
  } else if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  } else if (host) {
    baseUrl = `${proto}://${host}`;
  } else {
    baseUrl = 'https://www.socialtools.click';
  }

  return `${baseUrl}/api/auth/callback/google`;
}

/**
 * Extracts and verifies the session from a NextRequest.
 */
export function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (!cookie || !cookie.value) return null;
  return verifySession(cookie.value);
}

/**
 * Extracts and verifies the entitlements ledger from a NextRequest.
 */
export function getEntitlementsFromRequest(request: NextRequest): EntitlementsCookiePayload | null {
  const cookie = request.cookies.get(ENTITLEMENTS_COOKIE_NAME);
  if (!cookie || !cookie.value) return null;
  return verifyEntitlements(cookie.value);
}

/**
 * Sets the signed session cookie on a NextResponse.
 */
export function setSessionCookie(response: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Sets the signed entitlements cookie on a NextResponse.
 */
export function setEntitlementsCookie(response: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  response.cookies.set({
    name: ENTITLEMENTS_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Clears the session cookie by setting maxAge = 0.
 */
export function clearSessionCookie(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Clears the entitlements cookie by setting maxAge = 0.
 */
export function clearEntitlementsCookie(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  response.cookies.set({
    name: ENTITLEMENTS_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Clears temporary OAuth CSRF and return destination cookies.
 */
export function clearOAuthCookies(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set({
    name: OAUTH_RETURN_TO_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
