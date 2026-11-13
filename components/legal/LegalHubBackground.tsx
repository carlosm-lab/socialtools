import Link from 'next/link';
import {
  Shield,
  FileText,
  RotateCcw,
  Scale,
  Cookie,
  CheckCircle2,
  Clock,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Breadcrumb } from '@/components/legal/Breadcrumb';

export interface LegalDoc {
  slug: string;
  title: string;
  tagline: string;
  icon: LucideIcon;
  available: boolean;
  readingTime: number;
  highlight?: string;
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'privacidad',
    title: 'POLÍTICA DE PRIVACIDAD',
    tagline:
      'Tratamiento de datos personales, autenticación segura con Google OAuth y arquitectura de cero subida de archivos a servidor.',
    icon: Shield,
    available: true,
    readingTime: 14,
  },
  {
    slug: 'terminos',
    title: 'TÉRMINOS Y CONDICIONES',
    tagline:
      'Condiciones vinculantes de servicio, licenciamiento SaaS, uso de créditos y reglas operativas del motor WebAssembly.',
    icon: FileText,
    available: true,
    readingTime: 18,
  },
  {
    slug: 'reembolsos',
    title: 'POLÍTICA DE NO REEMBOLSO',
    tagline:
      'Carácter firme, definitivo e irrevocable de la compra de créditos por uso y planes de suscripción digital.',
    icon: RotateCcw,
    available: true,
    readingTime: 12,
    highlight: 'Estricta',
  },
  {
    slug: 'aviso-legal',
    title: 'AVISO LEGAL',
    tagline:
      'Identificación corporativa del titular, propiedad industrial y Paddle.com como Comerciante Registrado (Merchant of Record).',
    icon: Scale,
    available: true,
    readingTime: 10,
  },
  {
    slug: 'cookies',
    title: 'POLÍTICA DE COOKIES',
    tagline:
      'Transparencia técnica: almacenamiento local (localStorage) y cookies técnicas de sesión con total ausencia de rastreadores publicitarios.',
    icon: Cookie,
    available: true,
    readingTime: 10,
  },
];

export interface LegalHubBackgroundProps {
  animated?: boolean;
}

export default function LegalHubBackground({
  animated = true,
}: LegalHubBackgroundProps) {
  const availableCount = LEGAL_DOCS.filter((d) => d.available).length;
  const transitionClass = animated
    ? 'transition-all duration-300 ease-out'
    : '';

  return (
    <div className="w-full bg-[#cfe8e1] min-h-screen py-8 sm:py-12 px-4 sm:px-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-10">
        {/* ── 1. Hero Card (Solid White, ZERO nested cards) ──────────────── */}
        <section className="bg-[#ffffff] border border-[#b8d8cf] rounded-2xl p-6 sm:p-10 shadow-sm space-y-6">
          <Breadcrumb
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Documentos Legales' },
            ]}
          />

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#002941] tracking-tight">
              Políticas y Documentación Legal
            </h1>
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#335467]">
              Marco Regulatorio, Transparencia y Condiciones Oficiales de SocialTools
            </p>
          </div>

          {/* Plain semantic content (NO nested cards) */}
          <p className="text-sm sm:text-base text-[#335467] leading-relaxed text-left">
            En esta sección recopilamos el marco regulatorio oficial, los términos
            contractuales y las garantías técnicas de SocialTools. Nuestro motor
            opera mediante WebAssembly procesando videos exclusivamente dentro de la
            memoria RAM de su dispositivo local. Todos los cobros y facturación son
            gestionados de manera segura e internacional por Paddle.com como Comerciante
            Registrado (Merchant of Record, Seller ID: 471198).
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-[#b8d8cf] text-xs font-semibold text-[#335467]">
            <span className="inline-flex items-center gap-1.5 text-[#002941]">
              <CheckCircle2 className="w-4 h-4" />
              {availableCount} políticas vigentes
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-[#b8d8cf]" />
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Actualizado: Noviembre 2026
            </span>
          </div>
        </section>

        {/* ── 2. Cards Grid (ZERO nested cards, ZERO pill badges) ─────────── */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {LEGAL_DOCS.map((doc) => {
              const IconComponent = doc.icon;
              return (
                <Link
                  key={doc.slug}
                  href={`/legal/${doc.slug}`}
                  aria-label={`Leer ${doc.title}: ${doc.tagline}`}
                  className={`group flex flex-col overflow-hidden rounded-2xl border border-[#b8d8cf] bg-[#ffffff] hover:border-[#002941] hover:-translate-y-1 hover:shadow-lg transition-all duration-200 cursor-pointer ${transitionClass}`}
                >
                  {/* Solid Midnight Navy banner (NO gradients, NO badges) */}
                  <div className="relative flex aspect-[32/14] w-full items-center justify-center bg-[#002941] text-[#cfe8e1]">
                    <IconComponent className="w-14 h-14 text-[#cfe8e1] group-hover:scale-105 transition-transform duration-200" />
                  </div>

                  {/* Info panel (Direct content area, NOT a nested card) */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-[#335467]">
                        {doc.readingTime} min de lectura
                        {doc.highlight && (
                          <span className="text-[#7f1d1d] font-bold"> · {doc.highlight}</span>
                        )}
                      </p>
                      <h2 className="text-sm font-extrabold text-[#002941] tracking-wide group-hover:text-[#001d2e] transition-colors">
                        {doc.title}
                      </h2>
                      <p className="text-xs text-[#335467] leading-relaxed line-clamp-3">
                        {doc.tagline}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#b8d8cf] flex items-center justify-between text-xs font-bold text-[#002941]">
                      <span>Leer documento</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
