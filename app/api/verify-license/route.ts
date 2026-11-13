import { NextRequest, NextResponse } from 'next/server';

export interface VerifyLicenseRequest {
  licenseKey: string;
  instanceId?: string;
}

export interface LicenseFeatures {
  unlimitedDuration: boolean;
  modeDeepAntiSynthID: boolean;
  modeMultiVariant: boolean;
  maxVariants: number;
  batchProcessing: boolean;
}

export interface VerifyLicenseResponse {
  valid: boolean;
  plan?: 'free' | 'creator' | 'agency';
  features?: LicenseFeatures;
  licenseInfo?: {
    key: string;
    status: string;
    variantName?: string;
    customerEmail?: string;
    customerName?: string;
  };
  isMock?: boolean;
  error?: string;
}

function resolvePlanFromPriceIds(priceIds: string[], fallbackText = ''): 'creator' | 'agency' {
  const agencyIds = [
    process.env.NEXT_PUBLIC_PADDLE_AGENCY_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_PADDLE_AGENCY_YEARLY_PRICE_ID,
    process.env.PADDLE_AGENCY_MONTHLY_PRICE_ID,
    process.env.PADDLE_AGENCY_YEARLY_PRICE_ID,
  ].filter(Boolean) as string[];

  const creatorIds = [
    process.env.NEXT_PUBLIC_PADDLE_CREATOR_PRICE_ID,
    process.env.NEXT_PUBLIC_PADDLE_CREATOR_YEARLY_PRICE_ID,
    'pri_01m74a277m21gvmdz3cxm7zkvj',
    'pri_01m74dfsy5vxssam0b31mypsbt',
  ].filter(Boolean) as string[];

  if (priceIds.some((id) => agencyIds.includes(id))) {
    return 'agency';
  }
  if (priceIds.some((id) => creatorIds.includes(id))) {
    return 'creator';
  }
  if (fallbackText.toLowerCase().includes('agenc')) {
    return 'agency';
  }
  return 'creator';
}

function buildPlanResponse(
  plan: 'creator' | 'agency',
  key: string,
  status: string,
  variantName: string,
  isMock: boolean,
  customerEmail?: string
): VerifyLicenseResponse {
  const isAgency = plan === 'agency';
  return {
    valid: true,
    plan,
    features: {
      unlimitedDuration: true,
      modeDeepAntiSynthID: true,
      modeMultiVariant: isAgency,
      maxVariants: isAgency ? 10 : 1,
      batchProcessing: isAgency,
    },
    licenseInfo: {
      key,
      status,
      variantName,
      customerEmail,
    },
    isMock,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse<VerifyLicenseResponse>> {
  try {
    let body: VerifyLicenseRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { valid: false, error: 'Cuerpo de solicitud JSON no válido.' },
        { status: 400 }
      );
    }

    const rawKey = body?.licenseKey?.trim() || '';

    if (!rawKey) {
      return NextResponse.json(
        { valid: false, error: 'Ingresa tu ID de suscripción Paddle (sub_...), transacción (txn_...) o correo.' },
        { status: 400 }
      );
    }

    // Acceso permanente ilimitado para la cuenta administrativa negocios.axkarl@gmail.com
    if (rawKey.toLowerCase() === 'negocios.axkarl@gmail.com') {
      return NextResponse.json(
        buildPlanResponse(
          'agency',
          'admin_unlimited_negocios_axkarl',
          'active',
          'SocialTools — Plan Ilimitado Permanente (Admin)',
          false,
          'negocios.axkarl@gmail.com'
        )
      );
    }

    const apiKey = process.env.PADDLE_API_KEY;
    const allowDevMock = !apiKey || process.env.ALLOW_DEV_MOCK_KEYS === 'true';
    const isPaddleIdOrEmail =
      rawKey.startsWith('sub_') || rawKey.startsWith('txn_') || rawKey.includes('@');

    // --- MODO PRUEBAS LOCALES / CI (solo si no hay PADDLE_API_KEY o ALLOW_DEV_MOCK_KEYS=true) ---
    if (allowDevMock && !isPaddleIdOrEmail) {
      const upperKey = rawKey.toUpperCase();

      if (
        upperKey.includes('INVALID') ||
        upperKey.includes('EXPIRED') ||
        upperKey.startsWith('ERR-')
      ) {
        return NextResponse.json({
          valid: false,
          error: 'La clave o ID introducido no es válido o ha expirado.',
          isMock: true,
        });
      }

      const isAgency =
        upperKey.includes('AGENCY') ||
        upperKey.startsWith('AG-') ||
        upperKey.startsWith('AGENCY-');

      const plan: 'creator' | 'agency' = isAgency ? 'agency' : 'creator';
      return NextResponse.json(
        buildPlanResponse(
          plan,
          rawKey,
          'active',
          isAgency ? 'Plan Agencia (Modo Pruebas)' : 'Plan Creador (Modo Pruebas)',
          true,
          'negocios.axkarl@gmail.com'
        )
      );
    }

    if (!apiKey) {
      return NextResponse.json({
        valid: false,
        error: 'Paddle API Key no configurada en el servidor.',
      });
    }

    // --- VALIDACIÓN OFICIAL CONTRA PADDLE BILLING API v1 ---
    const paddleBase =
      process.env.NEXT_PUBLIC_PADDLE_ENV === 'sandbox'
        ? 'https://sandbox-api.paddle.com'
        : 'https://api.paddle.com';

    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    // 1. Verificar por ID de Suscripción (sub_...)
    if (rawKey.startsWith('sub_')) {
      const res = await fetch(`${paddleBase}/subscriptions/${encodeURIComponent(rawKey)}`, {
        headers,
        cache: 'no-store',
      });
      if (!res.ok) {
        return NextResponse.json({
          valid: false,
          error: 'No se encontró una suscripción Paddle válida con ese ID.',
        });
      }
      const json = await res.json();
      const sub = json?.data;
      if (!sub || !['active', 'trialing'].includes(sub.status)) {
        return NextResponse.json({
          valid: false,
          error: `La suscripción se encuentra en estado "${sub?.status || 'inactivo'}".`,
        });
      }
      const priceIds: string[] = Array.isArray(sub.items)
        ? sub.items.map((it: { price?: { id?: string } }) => it?.price?.id || '').filter(Boolean)
        : [];
      const fallbackNames = Array.isArray(sub.items)
        ? sub.items
            .map(
              (it: { price?: { description?: string; name?: string }; product?: { name?: string } }) =>
                `${it?.price?.name || ''} ${it?.price?.description || ''} ${it?.product?.name || ''}`
            )
            .join(' ')
        : '';
      const plan = resolvePlanFromPriceIds(priceIds, fallbackNames);
      return NextResponse.json(
        buildPlanResponse(
          plan,
          rawKey,
          sub.status,
          plan === 'agency' ? 'CleanStream Studio — Plan Agencia' : 'CleanStream Studio — Plan Creador',
          false
        )
      );
    }

    // 2. Verificar por ID de Transacción (txn_...)
    if (rawKey.startsWith('txn_')) {
      const res = await fetch(`${paddleBase}/transactions/${encodeURIComponent(rawKey)}`, {
        headers,
        cache: 'no-store',
      });
      if (!res.ok) {
        return NextResponse.json({
          valid: false,
          error: 'No se encontró la transacción de Paddle indicada.',
        });
      }
      const json = await res.json();
      const txn = json?.data;
      if (!txn || !['completed', 'paid', 'billed'].includes(txn.status)) {
        return NextResponse.json({
          valid: false,
          error: `El pago aún no está completado (estado: "${txn?.status || 'pendiente'}").`,
        });
      }
      const priceIds: string[] = Array.isArray(txn.items)
        ? txn.items
            .map((it: { price_id?: string; price?: { id?: string } }) => it?.price_id || it?.price?.id || '')
            .filter(Boolean)
        : [];
      const fallbackNames = Array.isArray(txn.items)
        ? txn.items
            .map(
              (it: { price?: { description?: string; name?: string } }) =>
                `${it?.price?.name || ''} ${it?.price?.description || ''}`
            )
            .join(' ')
        : '';
      const plan = resolvePlanFromPriceIds(priceIds, fallbackNames);
      return NextResponse.json(
        buildPlanResponse(
          plan,
          txn.subscription_id || rawKey,
          txn.status,
          plan === 'agency' ? 'CleanStream Studio — Plan Agencia' : 'CleanStream Studio — Plan Creador',
          false
        )
      );
    }

    // 3. Verificar por correo de cliente registrado en Paddle
    if (rawKey.includes('@')) {
      const custRes = await fetch(
        `${paddleBase}/customers?email=${encodeURIComponent(rawKey.toLowerCase())}`,
        { headers, cache: 'no-store' }
      );
      if (!custRes.ok) {
        return NextResponse.json({
          valid: false,
          error: 'No fue posible consultar tu suscripción por correo en Paddle.',
        });
      }
      const custJson = await custRes.json();
      const customers = Array.isArray(custJson?.data) ? custJson.data : [];
      for (const cust of customers) {
        const subRes = await fetch(
          `${paddleBase}/subscriptions?customer_id=${encodeURIComponent(cust.id)}&status=active,trialing`,
          { headers, cache: 'no-store' }
        );
        if (!subRes.ok) continue;
        const subJson = await subRes.json();
        const subs = Array.isArray(subJson?.data) ? subJson.data : [];
        if (subs.length > 0) {
          const activeSub = subs[0];
          const priceIds: string[] = Array.isArray(activeSub.items)
            ? activeSub.items
                .map((it: { price?: { id?: string } }) => it?.price?.id || '')
                .filter(Boolean)
            : [];
          const plan = resolvePlanFromPriceIds(priceIds);
          return NextResponse.json(
            buildPlanResponse(
              plan,
              activeSub.id,
              activeSub.status,
              plan === 'agency'
                ? 'CleanStream Studio — Plan Agencia'
                : 'CleanStream Studio — Plan Creador',
              false,
              cust.email
            )
          );
        }
      }
      return NextResponse.json({
        valid: false,
        error: 'No se encontró una suscripción activa asociada a ese correo en Paddle.',
      });
    }

    return NextResponse.json({
      valid: false,
      error:
        'Formato no reconocido. Ingresa tu ID de suscripción Paddle (sub_...), transacción (txn_...) o el correo usado al pagar.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { valid: false, error: `Error interno al validar con Paddle: ${message}` },
      { status: 500 }
    );
  }
}
