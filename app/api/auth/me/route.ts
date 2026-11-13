import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionFromRequest,
  getEntitlementsFromRequest,
  clearSessionCookie,
  clearEntitlementsCookie,
  setEntitlementsCookie,
  signEntitlements,
} from '@/lib/auth';
import { getUserByEmail, isAdminEmail, ADMIN_UNLIMITED_CREDITS, reconcileUserWithEntitlements } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
      },
      { status: 200 }
    );
  }

  const entitlementsLedger = getEntitlementsFromRequest(request);

  try {
    let dbUser = await getUserByEmail(session.email);

    if (!dbUser && entitlementsLedger && entitlementsLedger.email.toLowerCase() === session.email.toLowerCase()) {
      // Serverless cold start fallback: recover user from signed entitlements cookie
      dbUser = await reconcileUserWithEntitlements(entitlementsLedger, {
        name: session.name,
        picture: session.picture,
      });
    }

    if (!dbUser) {
      // User was explicitly deleted or cannot be found
      const response = NextResponse.json(
        {
          authenticated: false,
          user: null,
        },
        { status: 200 }
      );
      clearSessionCookie(response);
      clearEntitlementsCookie(response);
      return response;
    }

    const isAdmin = dbUser.role === 'admin' || isAdminEmail(dbUser.email);
    const credits = isAdmin ? ADMIN_UNLIMITED_CREDITS : dbUser.credits;

    const response = NextResponse.json(
      {
        authenticated: true,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          picture: dbUser.picture,
          role: dbUser.role,
          plan: dbUser.plan,
          credits,
          isAdmin,
          subscriptionPlan: dbUser.subscriptionPlan || null,
          subscriptionStatus: dbUser.subscriptionStatus || null,
        },
      },
      { status: 200 }
    );

    // Keep entitlements cookie ledger synchronized
    const refreshedLedgerToken = signEntitlements({
      sub: dbUser.googleId || dbUser.id,
      email: dbUser.email,
      credits,
      trialGranted: true,
      plan: dbUser.plan,
      processedTxIds: entitlementsLedger?.processedTxIds || [],
    });
    setEntitlementsCookie(response, refreshedLedgerToken);

    return response;
  } catch (error) {
    console.error('[API /api/auth/me] Database query exception, utilizing session/entitlements fallback:', error);
    const isAdmin = session.role === 'admin' || isAdminEmail(session.email);
    const fallbackCredits = isAdmin
      ? ADMIN_UNLIMITED_CREDITS
      : (entitlementsLedger ? entitlementsLedger.credits : 0);

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: session.userId,
          email: session.email,
          name: session.name,
          picture: session.picture,
          role: session.role,
          plan: session.plan,
          credits: fallbackCredits,
          isAdmin,
        },
      },
      { status: 200 }
    );
  }
}
