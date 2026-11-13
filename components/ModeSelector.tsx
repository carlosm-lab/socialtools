'use client';

import React from 'react';
import { Zap, ShieldCheck, Copy, Lock } from 'lucide-react';

export type ProcessingMode = 'fast' | 'deep' | 'spoofer';

interface ModeSelectorProps {
  activeMode: ProcessingMode;
  onChangeMode: (mode: ProcessingMode) => void;
  variantCount: 3 | 5 | 10;
  onChangeVariantCount: (cnt: 3 | 5 | 10) => void;
  userPlan: 'free' | 'creator' | 'agency';
}

export default function ModeSelector({
  activeMode,
  onChangeMode,
  variantCount,
  onChangeVariantCount,
  userPlan,
}: ModeSelectorProps) {
  const isCreatorOrAgency = userPlan === 'creator' || userPlan === 'agency';
  const isAgency = userPlan === 'agency';

  const modes: Array<{
    id: ProcessingMode;
    title: string;
    subtitle: string;
    tierLabel: string;
    locked: boolean;
    icon: React.ReactNode;
  }> = [
    {
      id: 'fast',
      title: 'Purga Rápida C2PA',
      subtitle: 'Elimina metadatos ocultos en ~1s sin recodificar.',
      tierLabel: 'Gratis hasta 20s',
      locked: false,
      icon: <Zap className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'deep',
      title: 'Escudo Anti-SynthID',
      subtitle: 'Neutraliza firmas invisibles en píxeles y audio.',
      tierLabel: isCreatorOrAgency ? 'Activo' : 'Plan Creator',
      locked: !isCreatorOrAgency,
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'spoofer',
      title: 'Multi-Variant Spoofer',
      subtitle: 'Genera 3, 5 o 10 copias con hashes únicos.',
      tierLabel: isAgency ? 'Activo' : 'Plan Agency',
      locked: !isAgency,
      icon: <Copy className="w-4 h-4 shrink-0" />,
    },
  ];

  const currentModeInfo = modes.find((m) => m.id === activeMode) || modes[0];

  return (
    <div className="space-y-4">
      {/* Selector plano de 3 modos integrado directamente en el bloque blanco (sin píldoras ni tarjetas dentro de tarjetas) */}
      <div
        role="tablist"
        aria-label="Modos de sanitización"
        className="bg-[#eaf5f1] p-1 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-1"
      >
        {modes.map((m) => {
          const isActive = activeMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChangeMode(m.id)}
              className={`min-h-[56px] rounded-lg px-4 py-3 text-left transition-colors flex flex-col justify-between gap-1 select-none ${
                isActive
                  ? 'bg-[#002941] text-white'
                  : 'bg-transparent text-[#002941] hover:bg-white/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="inline-flex items-center gap-2 text-sm font-bold tracking-tight">
                  <span className={isActive ? 'text-[#cfe8e1]' : 'text-[#002941]'}>
                    {m.icon}
                  </span>
                  <span>{m.title}</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                    isActive
                      ? 'text-[#cfe8e1]'
                      : m.locked
                      ? 'text-[#7f1d1d]'
                      : 'text-[#335467]'
                  }`}
                >
                  {m.locked && <Lock className="w-3 h-3" />}
                  {m.tierLabel}
                </span>
              </div>
              <p
                className={`text-xs leading-snug ${
                  isActive ? 'text-[#cfe8e1]/90' : 'text-[#335467]'
                }`}
              >
                {m.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Aviso de desbloqueo si el modo requiere licencia */}
      {currentModeInfo.locked && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#7f1d1d]">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {currentModeInfo.title} requiere activar {currentModeInfo.tierLabel}.
            </span>
          </span>
          <a
            href="#activar-licencia"
            className="font-bold text-[#002941] hover:underline shrink-0"
          >
            Activar licencia o ver planes →
          </a>
        </div>
      )}

      {/* Selector inline de copias únicas para Modo 3 */}
      {activeMode === 'spoofer' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#b8d8cf]/70 text-xs">
          <span className="font-semibold text-[#002941]">
            Cantidad de copias únicas por video:
          </span>
          <div className="grid grid-cols-3 sm:inline-flex bg-[#eaf5f1] p-1 rounded-xl gap-1 w-full sm:w-auto">
            {([3, 5, 10] as const).map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => onChangeVariantCount(cnt)}
                className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-xs font-bold transition-colors select-none ${
                  variantCount === cnt
                    ? 'bg-[#002941] text-white'
                    : 'text-[#002941] hover:bg-white'
                }`}
              >
                {cnt} copias
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
