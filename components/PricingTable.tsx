'use client';

import React, { useState } from 'react';
import { Check, Minus, ArrowRight, Plus } from 'lucide-react';

const CREATOR_MONTHLY_PRICE_ID =
  process.env.NEXT_PUBLIC_PADDLE_CREATOR_PRICE_ID || 'pri_01m74a277m21gvmdz3cxm7zkvj';
const CREATOR_YEARLY_PRICE_ID =
  process.env.NEXT_PUBLIC_PADDLE_CREATOR_YEARLY_PRICE_ID || 'pri_01m74dfsy5vxssam0b31mypsbt';
const AGENCY_MONTHLY_PRICE_ID =
  process.env.NEXT_PUBLIC_PADDLE_AGENCY_MONTHLY_PRICE_ID || 'pri_01m74a47sk3hgk88g6d0m74vb4';
const AGENCY_YEARLY_PRICE_ID =
  process.env.NEXT_PUBLIC_PADDLE_AGENCY_YEARLY_PRICE_ID || 'pri_01m74a5149xvd3aaryv39syj2j';
const CREDITS_PRICE_ID =
  process.env.NEXT_PUBLIC_PADDLE_CREDITS_PRICE_ID || 'pri_01m74dmhw68kw11nq225g0rkpr';

export interface PricingTableProps {
  currentUser?: {
    id: string;
    email: string;
    name?: string;
    credits?: number;
    plan?: string;
  } | null;
}

export function sanitizeCreditQuantity(raw: string | number): number {
  const parsed = typeof raw === 'number' ? Math.floor(raw) : parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 5) {
    return 5;
  }
  return Math.min(1000, Math.max(5, parsed));
}

export default function PricingTable({ currentUser }: PricingTableProps) {
  const [selectedMobilePlan, setSelectedMobilePlan] = useState<'free' | 'creator' | 'agency'>('agency');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [creditQuantity, setCreditQuantity] = useState<number>(5);
  const [creditInputRaw, setCreditInputRaw] = useState<string>('5');

  const userQuerySuffix = currentUser
    ? `&userId=${encodeURIComponent(currentUser.id)}&email=${encodeURIComponent(currentUser.email)}`
    : '';

  const activeCreatorPriceId =
    billingCycle === 'yearly' ? CREATOR_YEARLY_PRICE_ID : CREATOR_MONTHLY_PRICE_ID;

  const creatorCheckoutHref = activeCreatorPriceId
    ? `/checkout?priceId=${encodeURIComponent(activeCreatorPriceId)}&plan=${encodeURIComponent(
        billingCycle === 'yearly'
          ? 'SocialTools — Plan Creador Anual ($79/año)'
          : 'SocialTools — Plan Creador Mensual ($9.99/mes)'
      )}&quantity=1${userQuerySuffix}`
    : '#activar-licencia';

  const activeAgencyPriceId =
    billingCycle === 'yearly' ? AGENCY_YEARLY_PRICE_ID : AGENCY_MONTHLY_PRICE_ID;

  const agencyCheckoutHref = activeAgencyPriceId
    ? `/checkout?priceId=${encodeURIComponent(activeAgencyPriceId)}&plan=${encodeURIComponent(
        billingCycle === 'yearly'
          ? 'SocialTools — Plan Agencia Anual ($99/año)'
          : 'SocialTools — Plan Agencia Mensual ($19.99/mes)'
      )}&quantity=1${userQuerySuffix}`
    : '#activar-licencia';

  const validCreditsQty = sanitizeCreditQuantity(creditQuantity);
  const creditsCheckoutHref = `/checkout?plan=pay_per_use&type=credits&priceId=${encodeURIComponent(
    CREDITS_PRICE_ID
  )}&quantity=${validCreditsQty}${userQuerySuffix}`;

  const handleCreditInputChange = (val: string) => {
    setCreditInputRaw(val);
    const parsed = parseInt(val, 10);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 5) {
      setCreditQuantity(Math.min(1000, Math.max(5, parsed)));
    }
  };

  const handleCreditInputBlur = () => {
    const clean = sanitizeCreditQuantity(creditInputRaw);
    setCreditQuantity(clean);
    setCreditInputRaw(String(clean));
  };

  const adjustCredits = (delta: number) => {
    const next = sanitizeCreditQuantity(creditQuantity + delta);
    setCreditQuantity(next);
    setCreditInputRaw(String(next));
  };

  const selectPresetCredits = (qty: number) => {
    const clean = sanitizeCreditQuantity(qty);
    setCreditQuantity(clean);
    setCreditInputRaw(String(clean));
  };

  const plans = [
    {
      id: 'free' as const,
      name: 'Prueba Gratuita',
      target: 'Al iniciar sesión con Google',
      price: '$0 USD',
      period: '1 video gratis incluido',
      description: 'Recibe 1 crédito gratuito de creador al iniciar sesión con tu cuenta de Google.',
      ctaText: currentUser ? 'Usar estudio arriba' : 'Iniciar sesión (1 video gratis)',
      ctaUrl: currentUser ? '#estudio' : '/api/auth/google',
      features: [
        { label: 'Purga rápida de metadatos C2PA, XMP y EXIF', included: true, note: '1 video gratis' },
        { label: 'Duración máxima por video', included: true, note: 'Hasta 20 segundos' },
        { label: 'Escudo Profundo Anti-SynthID', included: false, note: 'Requiere Creador o Créditos' },
        { label: 'Filtro acústico 20Hz–19.5kHz', included: false, note: 'No incluido' },
        { label: 'Multi-Variant Spoofer (copias por lote)', included: false, note: '1 archivo' },
        { label: 'Privacidad de procesamiento', included: true, note: '100% Local en tu navegador' },
      ],
    },
    {
      id: 'creator' as const,
      name: billingCycle === 'yearly' ? 'Plan Creador Anual' : 'Plan Creador',
      target: 'Creadores TikTok / Reels / Shorts',
      price: billingCycle === 'yearly' ? '$79 USD' : '$9.99 USD',
      period: billingCycle === 'yearly' ? '/ año · ahorra 34% vs mensual' : '/ mes · o $79 USD / año',
      description: 'Videos ilimitados sin tope de duración. Neutraliza marcas de Veo 3.1, Sora y Runway.',
      ctaText:
        billingCycle === 'yearly'
          ? 'Suscribirme al Plan Creador Anual ($79/año)'
          : 'Suscribirme ($9.99/mes)',
      ctaUrl: creatorCheckoutHref,
      features: [
        { label: 'Purga rápida de metadatos C2PA, XMP y EXIF', included: true, note: 'Ilimitado' },
        { label: 'Duración máxima por video', included: true, note: 'Ilimitado (sin tope de 30s)' },
        { label: 'Escudo Profundo Anti-SynthID', included: true, note: 'Ilimitado' },
        { label: 'Filtro acústico 20Hz–19.5kHz', included: true, note: 'Incluido' },
        { label: 'Multi-Variant Spoofer (copias por lote)', included: false, note: '1 archivo' },
        { label: 'Privacidad de procesamiento', included: true, note: 'Ilimitado · 100% Local' },
      ],
    },
    {
      id: 'agency' as const,
      name: billingCycle === 'yearly' ? 'Plan Agencia Anual' : 'Plan Agencia',
      target: 'Agencias UGC & Escala',
      price: billingCycle === 'yearly' ? '$99 USD' : '$19.99 USD',
      period: billingCycle === 'yearly' ? '/ año · ahorra 58% vs mensual' : '/ mes · o $99 USD / año',
      description: 'Genera hasta 10 copias con hashes únicos para distribuir en múltiples cuentas.',
      ctaText:
        billingCycle === 'yearly' ? 'Obtener Pase Agencia Anual ($99/año)' : 'Suscribirme ($19.99/mes)',
      ctaUrl: agencyCheckoutHref,
      features: [
        { label: 'Purga rápida de metadatos C2PA, XMP y EXIF', included: true, note: 'Ilimitado' },
        { label: 'Duración máxima por video', included: true, note: 'Ilimitado (sin tope de 30s)' },
        { label: 'Escudo Profundo Anti-SynthID', included: true, note: 'Ilimitado' },
        { label: 'Filtro acústico 20Hz–19.5kHz', included: true, note: 'Incluido' },
        { label: 'Multi-Variant Spoofer (copias por lote)', included: true, note: '3, 5 o 10 copias únicas' },
        { label: 'Privacidad de procesamiento', included: true, note: 'Ilimitado · 100% Local' },
      ],
    },
  ];

  const currentMobilePlanData = plans.find((p) => p.id === selectedMobilePlan) || plans[1];

  return (
    <div className="bg-[#ffffff] border border-[#b8d8cf] rounded-2xl overflow-hidden">
      {/* Cabecera del bloque blanco de Planes */}
      <div className="px-5 py-6 sm:px-8 sm:py-7 border-b border-[#b8d8cf] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#335467] block">
            Flexibilidad total · Suscripción ilimitada o Pago por Uso ($1 USD / video)
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-[#002941] tracking-tight mt-1">
            Planes para Creadores, Agencias y Pago por Uso
          </h3>
          <p className="text-xs sm:text-sm text-[#335467] mt-1.5 max-w-2xl leading-relaxed">
            Inicia sesión con Google para recibir 1 video gratis de prueba, compra paquetes desde 5 videos ($1 USD por video) o activa acceso ilimitado mensual o anual.
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <span className="text-xs font-semibold text-[#335467]">
            Ciclo de facturación (Creador y Agencia)
          </span>
          <div className="inline-flex bg-[#eaf5f1] p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`min-h-[44px] px-3.5 rounded-lg text-xs font-bold transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-[#002941] text-white'
                  : 'text-[#002941] hover:bg-white'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`min-h-[44px] px-3.5 rounded-lg text-xs font-bold transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-[#002941] text-white'
                  : 'text-[#002941] hover:bg-white'
              }`}
            >
              Anual (Creador $79 · Agencia $99)
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN PAGO POR USO (Pay-Per-Use: $1 USD por video, mínimo 5 videos) */}
      <div className="px-5 py-6 sm:px-8 sm:py-6 border-b border-[#b8d8cf] bg-[#eaf5f1]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#002941] block">
              Modalidad Pago por Uso · Sin suscripción recurrente
            </span>
            <h4 className="text-lg sm:text-xl font-extrabold text-[#002941]">
              Compra solo los videos que necesites crear ($1.00 USD por video)
            </h4>
            <p className="text-xs text-[#335467] leading-relaxed">
              Paquete mínimo de <strong>5 videos ($5.00 USD)</strong>. Tus créditos quedan asociados a tu cuenta de Google y no caducan.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Selector numérico de cantidad de videos (mínimo 5, entero) */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pay-per-use-quantity"
                className="text-[11px] font-bold text-[#002941]"
              >
                ¿Cuántos videos quieres crear? (mín. 5)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustCredits(-1)}
                  disabled={creditQuantity <= 5}
                  aria-label="Disminuir cantidad de videos"
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-[#b8d8cf] bg-[#ffffff] text-[#002941] font-bold text-sm flex items-center justify-center disabled:opacity-40 hover:bg-[#f7fbf9]"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  id="pay-per-use-quantity"
                  type="number"
                  min={5}
                  max={1000}
                  step={1}
                  inputMode="numeric"
                  value={creditInputRaw}
                  onChange={(e) => handleCreditInputChange(e.target.value)}
                  onBlur={handleCreditInputBlur}
                  aria-label="Cantidad de créditos de video"
                  className="min-h-[44px] w-24 px-3 rounded-xl border border-[#b8d8cf] bg-[#ffffff] text-center font-mono text-base font-extrabold text-[#002941] focus:outline-none focus:border-[#002941]"
                />
                <button
                  type="button"
                  onClick={() => adjustCredits(1)}
                  aria-label="Aumentar cantidad de videos"
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-[#b8d8cf] bg-[#ffffff] text-[#002941] font-bold text-sm flex items-center justify-center hover:bg-[#f7fbf9]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {[5, 10, 25, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => selectPresetCredits(preset)}
                    className={`min-h-[36px] px-2.5 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-colors ${
                      validCreditsQty === preset
                        ? 'bg-[#002941] text-white border-[#002941]'
                        : 'bg-[#ffffff] text-[#002941] border-[#b8d8cf] hover:bg-[#f7fbf9]'
                    }`}
                  >
                    {preset} videos
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between sm:pl-3 sm:border-l border-[#b8d8cf] gap-2">
              <div>
                <div className="text-[11px] font-semibold text-[#335467]">Total a pagar</div>
                <div className="text-2xl font-extrabold text-[#002941] font-mono">
                  ${validCreditsQty}.00 <span className="text-xs font-sans font-semibold">USD</span>
                </div>
                <div className="text-[11px] text-[#335467]">
                  {validCreditsQty} créditos · $1.00 USD c/u
                </div>
              </div>
              <a
                href={creditsCheckoutHref}
                className="btn-navy min-h-[44px] px-5 text-xs font-bold whitespace-nowrap"
              >
                <span>
                  Comprar {validCreditsQty} videos (${validCreditsQty} USD)
                </span>
                <ArrowRight className="w-4 h-4 text-[#cfe8e1] shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* VISTA MÓVIL (<768px): Selector compacto plano y lista por divisores de 1px */}
      <div className="md:hidden p-4 space-y-5">
        <div
          role="tablist"
          aria-label="Selector de planes móvil"
          className="bg-[#eaf5f1] p-1 rounded-xl grid grid-cols-3 gap-1"
        >
          {plans.map((p) => {
            const isSelected = selectedMobilePlan === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedMobilePlan(p.id)}
                className={`min-h-[48px] rounded-lg px-2 py-2 text-xs font-bold transition-colors flex flex-col items-center justify-center select-none ${
                  isSelected ? 'bg-[#002941] text-white' : 'text-[#002941] hover:bg-white'
                }`}
              >
                <span className="truncate">{p.id === 'creator' ? 'Creador' : p.id === 'agency' ? 'Agencia' : 'Gratis'}</span>
                <span
                  className={`text-[10px] font-normal ${
                    isSelected ? 'text-[#cfe8e1]' : 'text-[#335467]'
                  }`}
                >
                  {p.price}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#335467]">
              {currentMobilePlanData.target}
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-extrabold text-[#002941]">
                {currentMobilePlanData.price}
              </span>
              <span className="text-xs text-[#335467]">{currentMobilePlanData.period}</span>
            </div>
          </div>

          <p className="text-xs text-[#335467] leading-relaxed">
            {currentMobilePlanData.description}
          </p>

          <div className="divide-y divide-[#b8d8cf]/70 border-y border-[#b8d8cf]/70">
            {currentMobilePlanData.features.map((feat, idx) => (
              <div key={idx} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2">
                  {feat.included ? (
                    <Check className="w-4 h-4 text-[#002941] shrink-0 mt-0.5" />
                  ) : (
                    <Minus className="w-4 h-4 text-[#335467]/50 shrink-0 mt-0.5" />
                  )}
                  <span
                    className={
                      feat.included ? 'text-[#002941] font-medium' : 'text-[#335467]/75'
                    }
                  >
                    {feat.label}
                  </span>
                </div>
                <span
                  className={`font-semibold text-right shrink-0 ${
                    feat.included ? 'text-[#002941]' : 'text-[#335467]/60'
                  }`}
                >
                  {feat.note}
                </span>
              </div>
            ))}
          </div>

          {currentMobilePlanData.id === 'free' ? (
            <a href={currentMobilePlanData.ctaUrl} className="btn-outline-navy w-full min-h-[48px] text-xs font-bold">
              <span>{currentMobilePlanData.ctaText}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          ) : (
            <a
              href={currentMobilePlanData.ctaUrl}
              className="btn-navy w-full min-h-[48px] text-xs sm:text-sm font-bold"
            >
              <span>{currentMobilePlanData.ctaText}</span>
              <ArrowRight className="w-4 h-4 text-[#cfe8e1]" />
            </a>
          )}
        </div>
      </div>

      {/* VISTA ESCRITORIO (>=768px): Tabla comparativa limpia */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#b8d8cf]">
              <th className="py-5 px-6 w-[28%] align-bottom text-xs font-bold uppercase tracking-wider text-[#335467]">
                Capacidades
              </th>
              <th className="py-5 px-6 w-[24%] align-top">
                <div className="text-xs font-medium text-[#335467]">Al iniciar sesión con Google</div>
                <div className="text-lg font-extrabold text-[#002941] mt-0.5">Prueba Gratuita</div>
                <div className="text-xs text-[#335467] mt-1">$0 USD · 1 video gratis</div>
              </th>
              <th className="py-5 px-6 w-[24%] align-top">
                <div className="text-xs font-semibold text-[#002941]">Creadores TikTok / Reels</div>
                <div className="text-lg font-extrabold text-[#002941] mt-0.5">
                  {billingCycle === 'yearly' ? 'Plan Creador Anual' : 'Plan Creador'}
                </div>
                <div className="text-xs text-[#002941] font-semibold mt-1">
                  {billingCycle === 'yearly' ? '$79.00 USD ' : '$9.99 USD '}
                  <span className="font-normal text-[#335467]">
                    {billingCycle === 'yearly' ? '/ año (o $9.99/mes)' : '/ mes (o $79/año)'}
                  </span>
                </div>
              </th>
              <th className="py-5 px-6 w-[24%] align-top bg-[#eaf5f1]">
                <div className="text-xs font-bold text-[#002941]">Agencias UGC · Recomendado</div>
                <div className="text-lg font-extrabold text-[#002941] mt-0.5">
                  {billingCycle === 'yearly' ? 'Plan Agencia Anual' : 'Plan Agencia'}
                </div>
                <div className="text-xs text-[#002941] font-semibold mt-1">
                  {billingCycle === 'yearly' ? '$99.00 USD ' : '$19.99 USD '}
                  <span className="font-normal text-[#335467]">
                    {billingCycle === 'yearly' ? '/ año (o $19.99/mes)' : '/ mes (o $99/año)'}
                  </span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#b8d8cf]/65 text-xs sm:text-sm">
            <tr className="hover:bg-[#f7fbf9] transition-colors">
              <td className="py-4 px-6 font-semibold text-[#002941]">
                Purga completa de metadatos C2PA, XMP y EXIF
              </td>
              <td className="py-4 px-6 text-[#002941]">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> 1 video gratis
                </span>
              </td>
              <td className="py-4 px-6 text-[#002941]">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Ilimitado
                </span>
              </td>
              <td className="py-4 px-6 text-[#002941] bg-[#eaf5f1] font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Ilimitado
                </span>
              </td>
            </tr>

            <tr className="hover:bg-[#f7fbf9] transition-colors">
              <td className="py-4 px-6 font-semibold text-[#002941]">Duración máxima por video</td>
              <td className="py-4 px-6 text-[#7f1d1d] font-medium">Hasta 20 segundos</td>
              <td className="py-4 px-6 text-[#002941] font-semibold">Ilimitado (sin tope de 30s)</td>
              <td className="py-4 px-6 text-[#002941] bg-[#eaf5f1] font-bold">
                Ilimitado (sin tope de 30s)
              </td>
            </tr>

            <tr className="hover:bg-[#f7fbf9] transition-colors">
              <td className="py-4 px-6 font-semibold text-[#002941]">
                Escudo Profundo Anti-SynthID (Veo, Sora, Runway)
              </td>
              <td className="py-4 px-6 text-[#335467]">
                <span className="inline-flex items-center gap-1.5">
                  <Minus className="w-4 h-4" /> No incluido
                </span>
              </td>
              <td className="py-4 px-6 text-[#002941] font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Ilimitado
                </span>
              </td>
              <td className="py-4 px-6 text-[#002941] bg-[#eaf5f1] font-bold">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Ilimitado
                </span>
              </td>
            </tr>

            <tr className="hover:bg-[#f7fbf9] transition-colors">
              <td className="py-4 px-6 font-semibold text-[#002941]">
                Limpieza acústica ultrasónica (20Hz–19.5kHz)
              </td>
              <td className="py-4 px-6 text-[#335467]">
                <span className="inline-flex items-center gap-1.5">
                  <Minus className="w-4 h-4" /> No incluido
                </span>
              </td>
              <td className="py-4 px-6 text-[#002941] font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Incluido
                </span>
              </td>
              <td className="py-4 px-6 text-[#002941] bg-[#eaf5f1] font-bold">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Incluido
                </span>
              </td>
            </tr>

            <tr className="hover:bg-[#f7fbf9] transition-colors">
              <td className="py-4 px-6 font-semibold text-[#002941]">
                Agency Multi-Variant Spoofer (copias por lote)
              </td>
              <td className="py-4 px-6 text-[#335467]">1 archivo</td>
              <td className="py-4 px-6 text-[#335467]">1 archivo</td>
              <td className="py-4 px-6 text-[#002941] bg-[#eaf5f1] font-bold">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> 3, 5 o 10 copias únicas
                </span>
              </td>
            </tr>

            <tr className="hover:bg-[#f7fbf9] transition-colors">
              <td className="py-4 px-6 font-semibold text-[#002941]">
                Asociación con cuenta de Google y privacidad
              </td>
              <td className="py-4 px-6 text-[#002941]">1 crédito al iniciar sesión · Local</td>
              <td className="py-4 px-6 text-[#002941] font-medium">Ilimitado · 100% local</td>
              <td className="py-4 px-6 text-[#002941] bg-[#eaf5f1] font-bold">
                Ilimitado · 100% local
              </td>
            </tr>

            <tr>
              <td className="py-5 px-6 text-xs text-[#335467]">
                Activación inmediata tras completar checkout en Paddle
              </td>
              <td className="py-5 px-6 text-xs font-semibold text-[#002941]">
                <a
                  href={currentUser ? '#estudio' : '/api/auth/google'}
                  className="hover:underline inline-flex items-center gap-1 min-h-[44px]"
                >
                  <span>{currentUser ? 'Usar crédito en estudio' : 'Recibir 1 video gratis'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </td>
              <td className="py-5 px-6">
                <a
                  href={creatorCheckoutHref}
                  className="btn-outline-navy min-h-[44px] px-4 text-xs font-bold whitespace-nowrap"
                >
                  <span>
                    {billingCycle === 'yearly'
                      ? 'Plan Creador Anual ($79)'
                      : 'Plan Creador ($9.99/mes)'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </a>
              </td>
              <td className="py-5 px-6 bg-[#eaf5f1]">
                <a
                  href={agencyCheckoutHref}
                  className="btn-navy min-h-[44px] px-4 text-xs font-bold whitespace-nowrap"
                >
                  <span>
                    {billingCycle === 'yearly'
                      ? 'Plan Agencia Anual ($99)'
                      : 'Plan Agencia ($19.99/mes)'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#cfe8e1] shrink-0" />
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pie informativo con avisos legales y política de no reembolsos */}
      <div className="px-5 py-4 sm:px-8 border-t border-[#b8d8cf] bg-[#f7fbf9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-[#335467]">
        <span>
          Pagos procesados de forma segura por <strong>Paddle.com</strong> (Merchant of Record) y asociados a tu cuenta de Google.
        </span>
        <div className="flex flex-wrap items-center gap-4 font-semibold text-[#002941]">
          <a href="/legal/terminos" className="hover:underline">
            Términos de Uso
          </a>
          <a href="/legal/reembolsos" className="hover:underline">
            Política de No Devolución
          </a>
          <a href="/legal/privacidad" className="hover:underline">
            Privacidad
          </a>
        </div>
      </div>
    </div>
  );
}
