'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { initializePaddle, Paddle } from '@paddle/paddle-js';
import { ArrowLeft, Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

const CREDITS_PRICE_ID =
  process.env.NEXT_PUBLIC_PADDLE_CREDITS_PRICE_ID || 'pri_01m74dmhw68kw11nq225g0rkpr';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const priceIdParam = searchParams.get('priceId') || '';
  const ptxnParam = searchParams.get('_ptxn') || '';
  const planNameParam = searchParams.get('plan') || 'Suscripción SocialTools Studio';
  const rawQuantity = parseInt(searchParams.get('quantity') || '1', 10);
  const isCreditsPurchase =
    searchParams.get('type') === 'credits' ||
    searchParams.get('plan') === 'pay_per_use' ||
    priceIdParam === CREDITS_PRICE_ID;

  const quantity = isCreditsPurchase
    ? Math.min(1000, Math.max(5, Number.isFinite(rawQuantity) ? Math.floor(rawQuantity) : 5))
    : Math.max(1, Number.isFinite(rawQuantity) ? Math.floor(rawQuantity) : 1);

  const [status, setStatus] = useState<'loading' | 'ready' | 'completed' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedTxnId, setCompletedTxnId] = useState<string | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const environment =
      process.env.NEXT_PUBLIC_PADDLE_ENV === 'sandbox' ? 'sandbox' : 'production';

    if (!token) {
      setStatus('error');
      setErrorMsg(
        'El Client-Side Token de Paddle aún no está configurado en las variables de entorno (NEXT_PUBLIC_PADDLE_CLIENT_TOKEN).'
      );
      return;
    }

    if (!priceIdParam && !ptxnParam) {
      setStatus('error');
      setErrorMsg('No se especificó ningún plan o transacción de Paddle para abrir el checkout.');
      return;
    }

    let cancelled = false;

    async function startCheckout() {
      let resolvedUserId = searchParams.get('userId') || '';
      let resolvedUserEmail = searchParams.get('email') || '';

      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData?.authenticated && meData.user) {
            resolvedUserId = meData.user.id || resolvedUserId;
            resolvedUserEmail = meData.user.email || resolvedUserEmail;
          }
        }
      } catch {
        // Proceed with URL params if session check fails
      }

      try {
        const paddleInstance: Paddle | undefined = await initializePaddle({
          environment,
          token: token as string,
          eventCallback(event) {
            if (cancelled) return;
            if (event.name === 'checkout.loaded') {
              setStatus('ready');
            } else if (event.name === 'checkout.completed') {
              const txnId = event.data?.transaction_id || '';
              setCompletedTxnId(txnId);
              setStatus('completed');
              if (txnId) {
                setTimeout(() => {
                  router.push(`/?txn_id=${encodeURIComponent(txnId)}#estudio`);
                }, 1400);
              }
            } else if (event.name === 'checkout.error') {
              setStatus('error');
              setErrorMsg(
                'Paddle aún no puede procesar pagos en este dominio (verifica que la verificación empresarial y aprobación de https://www.socialtools.click estén aprobadas en tu panel de Paddle).'
              );
            }
          },
        });

        if (cancelled) return;
        if (!paddleInstance) {
          setStatus('error');
          setErrorMsg('No se pudo inicializar el SDK de Paddle en este navegador.');
          return;
        }

        if (ptxnParam) {
          paddleInstance.Checkout.open({
            transactionId: ptxnParam,
            settings: {
              displayMode: 'overlay',
              theme: 'light',
              locale: 'es',
            },
          });
        } else if (priceIdParam) {
          paddleInstance.Checkout.open({
            items: [{ priceId: priceIdParam, quantity }],
            customer: resolvedUserEmail ? { email: resolvedUserEmail } : undefined,
            customData: {
              userId: resolvedUserId || 'guest',
              userEmail: resolvedUserEmail || '',
              purchaseType: isCreditsPurchase ? 'credits' : 'subscription',
              videoCredits: isCreditsPurchase ? quantity : 0,
            },
            settings: {
              displayMode: 'overlay',
              theme: 'light',
              locale: 'es',
            },
          });
        }
        setStatus('ready');
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(
          `Error inicializando Paddle Checkout: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    startCheckout();

    return () => {
      cancelled = true;
    };
  }, [priceIdParam, ptxnParam, quantity, isCreditsPurchase, router, searchParams]);

  return (
    <div className="min-h-screen bg-[#cfe8e1] text-[#002941] py-10 px-4 sm:px-6 flex items-center justify-center">
      <div className="max-w-lg w-full bg-[#ffffff] border border-[#b8d8cf] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#b8d8cf] pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#002941] hover:underline min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al estudio</span>
          </Link>
          <span className="text-xs font-semibold text-[#335467]">Pago seguro vía Paddle</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-extrabold text-[#002941]">
            {isCreditsPurchase
              ? `Paquete Pago por Uso: ${quantity} Videos ($${quantity}.00 USD)`
              : planNameParam}
          </h1>
          <p className="text-xs text-[#335467] leading-relaxed">
            Facturación segura procesada por Paddle.com (Merchant of Record) en{' '}
            <strong>https://www.socialtools.click</strong>. Tu acceso o créditos se asociarán automáticamente a tu cuenta al completar el pago.
          </p>
        </div>

        {status === 'loading' && (
          <div className="py-6 flex items-center gap-3 text-sm font-semibold text-[#002941]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Abriendo ventana segura de pago Paddle...</span>
          </div>
        )}

        {status === 'ready' && (
          <div className="p-4 rounded-xl bg-[#eaf5f1] text-xs text-[#002941] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Checkout de Paddle activo ({quantity} {quantity === 1 ? 'unidad' : 'unidades'}). Si cerraste la ventana emergente de pago, recarga esta página o vuelve a seleccionar tu plan.
            </span>
          </div>
        )}

        {status === 'completed' && (
          <div className="p-4 rounded-xl bg-[#cfe8e1] text-xs text-[#002941] space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>¡Pago completado con éxito!</span>
            </div>
            <p>
              Redirigiendo al estudio con tu transacción{' '}
              <code className="font-mono font-bold">{completedTxnId}</code>...
            </p>
          </div>
        )}

        {status === 'error' && errorMsg && (
          <div className="p-4 rounded-xl bg-[#fdf2f2] text-xs text-[#7f1d1d] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMsg}</span>
          </div>
        )}

        <div className="pt-4 border-t border-[#b8d8cf] text-[11px] text-[#335467] flex flex-wrap items-center justify-between gap-2">
          <span>Todas las ventas digitales son definitivas y no reembolsables.</span>
          <div className="flex items-center gap-3 font-semibold text-[#002941]">
            <Link href="/legal/terminos" className="hover:underline">
              Términos
            </Link>
            <Link href="/legal/reembolsos" className="hover:underline">
              Política de No Reembolso
            </Link>
            <Link href="/legal/privacidad" className="hover:underline">
              Privacidad
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#cfe8e1] text-[#002941] flex items-center justify-center p-6 text-sm font-bold">
          Cargando Paddle Checkout...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
