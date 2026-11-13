import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionFromRequest,
  getEntitlementsFromRequest,
  signEntitlements,
  setEntitlementsCookie,
} from '@/lib/auth';
import {
  getUserById,
  getUserByEmail,
  deductCredit,
  isAdminEmail,
  ADMIN_UNLIMITED_CREDITS,
  reconcileUserWithEntitlements,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: 'Inicia sesión con Google para procesar tu video.' },
        { status: 401 }
      );
    }

    let user = await getUserById(session.userId);
    if (!user && session.email) {
      user = await getUserByEmail(session.email);
    }

    const entitlements = getEntitlementsFromRequest(req);
    if (!user && entitlements && entitlements.email.toLowerCase() === session.email.toLowerCase()) {
      user = await reconcileUserWithEntitlements(entitlements, {
        name: session.name,
        picture: session.picture,
      });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado en la base de datos.' },
        { status: 404 }
      );
    }

    // Bypass check: Admin or paid subscriptions do not consume credits
    const isAdmin = user.role === 'admin' || isAdminEmail(user.email);
    const isExempt =
      isAdmin ||
      user.plan === 'unlimited' ||
      user.plan === 'creator' ||
      user.plan === 'agency';

    if (isExempt) {
      return NextResponse.json({
        success: true,
        bypassed: true,
        plan: user.plan,
        credits: isAdmin ? ADMIN_UNLIMITED_CREDITS : user.credits,
        message: 'Acceso ilimitado activo. Sin consumo de créditos.',
      });
    }

    // Optional metadata in request body
    let body: { mode?: string; fileName?: string; videoDuration?: number } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const reason = body.fileName
      ? `Sanitización de video: ${body.fileName} (${body.mode || 'fast'})`
      : 'Video procesado';

    const result = await deductCredit(user.id, reason);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error ||
            'Saldo insuficiente: has utilizado todos tus créditos. Compra más créditos ($1 USD/video) o suscríbete a un plan.',
          credits: result.remaining,
          plan: user.plan,
        },
        { status: 402 }
      );
    }

    const response = NextResponse.json({
      success: true,
      bypassed: false,
      plan: user.plan,
      credits: result.remaining,
      deducted: 1,
      message: `1 crédito utilizado con éxito. Créditos restantes: ${result.remaining}`,
    });

    // Update dual-layer entitlements cookie with the newly decremented balance
    const updatedEntitlementsToken = signEntitlements({
      sub: user.googleId || user.id,
      email: user.email,
      credits: result.remaining,
      trialGranted: true,
      plan: user.plan,
      processedTxIds: entitlements?.processedTxIds || [],
    });
    setEntitlementsCookie(response, updatedEntitlementsToken);

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API /api/credits/consume] Internal error:', err);
    return NextResponse.json(
      { success: false, error: `Error interno al procesar crédito: ${message}` },
      { status: 500 }
    );
  }
}
